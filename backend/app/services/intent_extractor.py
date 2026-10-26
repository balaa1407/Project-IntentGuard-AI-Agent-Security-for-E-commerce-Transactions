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

    # 1. Detect product category
    category = "electronics"
    if "headphone" in cleaned or "audio" in cleaned or "earbuds" in cleaned or "airpods" in cleaned or "earphones" in cleaned or "headset" in cleaned:
        category = "headphones"
    elif "gaming" in cleaned and ("laptop" in cleaned or "pc" in cleaned or "computer" in cleaned or "notebook" in cleaned):
        category = "gaming laptop"
    elif "laptop" in cleaned or "macbook" in cleaned or "notebook" in cleaned or "thinkpad" in cleaned or "chromebook" in cleaned:
        category = "laptop"
    elif re.search(r"\b(?:smartphone|phone|iphone|galaxy|pixel|android|mobile)\b", cleaned):
        category = "smartphone"
    elif "smartwatch" in cleaned or "apple watch" in cleaned or "fitness band" in cleaned:
        category = "smartwatch"
    elif "watch" in cleaned or "timepiece" in cleaned:
        category = "watch"
    elif "tablet" in cleaned or "ipad" in cleaned or "tab" in cleaned:
        category = "tablet"
    elif "monitor" in cleaned or "display" in cleaned or "screen" in cleaned:
        category = "monitor"
    elif "tv" in cleaned or "television" in cleaned:
        category = "television"
    elif "camera" in cleaned or "dslr" in cleaned:
        category = "camera"
    elif "keyboard" in cleaned:
        category = "keyboard"
    elif "mouse" in cleaned:
        category = "mouse"
    elif "shoe" in cleaned or "sneaker" in cleaned or "footwear" in cleaned or "boot" in cleaned:
        category = "shoes"
    elif "shirt" in cleaned or "jacket" in cleaned or "hoodie" in cleaned or "clothing" in cleaned or "jeans" in cleaned:
        category = "clothing"
    else:
        # Extract noun phrase following buy / order / purchase
        match_noun = re.search(r"(?:buy|order|purchase|get|find)\s+(?:a|an|the)?\s*([a-z0-9\s\-]+?)(?:\s+(?:under|below|max|budget|for|with|from|upto|at)\b|$)", cleaned)
        if match_noun and len(match_noun.group(1).strip()) >= 3:
            extracted_cat = match_noun.group(1).strip()
            if "laptop" in extracted_cat:
                category = "gaming laptop" if "gaming" in extracted_cat else "laptop"
            else:
                category = extracted_cat
        else:
            category = "electronics"

    # 2. Extract maximum price / budget
    max_price = 80000.0
    lakh_match = re.search(r"(?:under|below|max|budget of|budget|upto|up to|less than|within)?\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]+)?)\s*lakh", cleaned)
    if lakh_match:
        max_price = float(lakh_match.group(1)) * 100000.0
    else:
        price_patterns = [
            r"(?:under|below|max|budget of|budget|upto|up to|less than|within|for)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)*)\s*(?:k\b)?",
            r"(?:₹|rs\.?|inr)\s*([0-9]+(?:,[0-9]+)*)\s*(?:k\b)?",
            r"\b([0-9]+)k\b",
            r"\b([0-9]{4,7})\b"
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

    # 3. Extract RAM requirements
    ram_min: Optional[int] = None
    ram_match = re.search(r"(?:min|at least|minimum)?\s*([0-9]{1,3})\s*(?:gb|gigabytes)?\s*ram\b", cleaned)
    if not ram_match:
        ram_match = re.search(r"\b([0-9]{1,3})\s*gb\b", cleaned)
    if ram_match:
        ram_min = int(ram_match.group(1))
    elif category == "gaming laptop":
        ram_min = 16

    # 4. Extract quantity
    max_quantity = 1
    qty_match = re.search(r"\b([1-9]|10)\s*(?:x|units?|items?|pieces?|pcs?|pairs?|laptops?|phones?|shoes?|devices?)\b", cleaned)
    if qty_match:
        max_quantity = int(qty_match.group(1))

    # 5. Extract seller trust
    seller_requirement = "trusted"
    if "any seller" in cleaned or "unverified" in cleaned or "cheapest" in cleaned:
        seller_requirement = "any"
    elif "official" in cleaned or "brand" in cleaned or "authorized" in cleaned or "verified" in cleaned:
        seller_requirement = "verified"
    elif "trusted" in cleaned or "reputable" in cleaned or "top rated" in cleaned:
        seller_requirement = "trusted"

    # 6. Check for adversarial prompt injection hints
    ambiguities = []
    injection_patterns = [
        r"ignore (?:previous|prior|above)",
        r"system override",
        r"unlimited budget",
        r"waive (?:all )?checks",
        r"bypass (?:policy|security)"
    ]
    for inj in injection_patterns:
        if re.search(inj, cleaned):
            ambiguities.append("Potential adversarial override detected in input; enforced safe deterministic defaults.")

    return IntentDraft(
        category=category,
        max_price=max_price,
        currency="INR",
        ram_min=ram_min,
        seller_requirement=seller_requirement,
        max_quantity=max_quantity,
        authorization_type="single_purchase",
        confidence_score=0.98 if not ambiguities else 0.50,
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
