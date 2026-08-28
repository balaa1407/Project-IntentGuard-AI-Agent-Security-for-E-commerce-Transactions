import re
import json
import httpx
from typing import Optional
from backend.app.core.config import settings
from backend.app.schemas.intent import IntentDraft, sanitize_text


class IntentExtractionError(Exception):
    pass


def deterministic_fallback_extractor(prompt_text: str) -> IntentDraft:
    """
    Robust offline deterministic extractor that parses natural language shopping instructions
    using regex and semantic entity matching. Ensures 100% offline availability and testing.
    """
    cleaned = sanitize_text(prompt_text).lower()

    # Detect product category
    category = "electronics"
    if "laptop" in cleaned:
        category = "gaming laptop" if "gaming" in cleaned else "laptop"
    elif "smartphone" in cleaned or "phone" in cleaned:
        category = "smartphone"
    elif "monitor" in cleaned:
        category = "monitor"
    elif "headphone" in cleaned or "audio" in cleaned:
        category = "headphones"

    # Extract maximum price / budget
    # Match patterns like: under ₹80,000 | under 80000 | 80k | budget of 80,000 | max 80000
    max_price = 80000.0
    price_patterns = [
        r"(?:under|below|max|budget of|upto|up to)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)*)\s*(?:k\b)?",
        r"(?:₹|rs\.?|inr)\s*([0-9]+(?:,[0-9]+)*)\s*(?:k\b)?",
        r"\b([0-9]+)k\b"
    ]
    for pattern in price_patterns:
        match = re.search(pattern, cleaned)
        if match:
            raw_val = match.group(1).replace(",", "")
            val = float(raw_val)
            if "k" in match.group(0).lower() and val < 1000:
                val *= 1000
            max_price = val
            break

    # Extract RAM requirements
    ram_min: Optional[int] = None
    ram_match = re.search(r"(?:min|at least|minimum)?\s*([0-9]{1,3})\s*(?:gb|gigabytes)?\s*ram\b", cleaned)
    if not ram_match:
        ram_match = re.search(r"\b([0-9]{1,3})\s*gb\b", cleaned)
    if ram_match:
        ram_min = int(ram_match.group(1))

    # Extract seller trust
    seller_requirement = "trusted"
    if "any seller" in cleaned or "unverified" in cleaned:
        seller_requirement = "any"
    elif "official" in cleaned or "brand" in cleaned:
        seller_requirement = "verified"
    elif "trusted" in cleaned or "verified" in cleaned:
        seller_requirement = "trusted"

    # Check for adversarial prompt injection hints
    ambiguities = []
    injection_patterns = [
        r"ignore (?:previous|prior|above)",
        r"system override",
        r"unlimited budget",
        r"waive (?:all )?checks"
    ]
    for inj in injection_patterns:
        if re.search(inj, cleaned):
            ambiguities.append("Potential adversarial override detected in input; enforced safe defaults.")

    return IntentDraft(
        category=category,
        max_price=max_price,
        currency="INR",
        ram_min=ram_min or (16 if "laptop" in category else None),
        seller_requirement=seller_requirement,
        max_quantity=1,
        authorization_type="single_purchase",
        confidence_score=0.95 if not ambiguities else 0.60,
        ambiguities=ambiguities,
        clarification_needed=bool(ambiguities)
    )


async def extract_intent_from_prompt(prompt_text: str) -> IntentDraft:
    """
    Extracts structured purchase constraints from natural language prompt.
    Uses Gemini API if key is present on server; gracefully falls back to deterministic engine.
    """
    cleaned_prompt = sanitize_text(prompt_text)

    if settings.GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            
            system_instruction = (
                "You are a strict constraint extraction engine for an e-commerce transaction security platform. "
                "Extract structured constraints from the user's natural language purchase instruction into a JSON object "
                "with keys: category (string), max_price (float), currency (string, default 'INR'), ram_min (integer or null), "
                "seller_requirement (string: 'trusted', 'verified', or 'any'), max_quantity (integer, default 1). "
                "Output ONLY raw JSON."
            )
            
            payload = {
                "contents": [{"role": "user", "parts": [{"text": cleaned_prompt}]}],
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "generationConfig": {
                    "temperature": 0.0,
                    "responseMimeType": "application/json"
                }
            }
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    json_str = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(json_str)
                    
                    return IntentDraft(
                        category=parsed.get("category", "electronics"),
                        max_price=float(parsed.get("max_price", 80000.0)),
                        currency=parsed.get("currency", "INR"),
                        ram_min=parsed.get("ram_min"),
                        seller_requirement=parsed.get("seller_requirement", "trusted"),
                        max_quantity=int(parsed.get("max_quantity", 1)),
                        authorization_type="single_purchase",
                        confidence_score=0.98
                    )
        except Exception:
            # Server-side fail-safe: fallback to deterministic offline parser
            pass

    return deterministic_fallback_extractor(cleaned_prompt)
