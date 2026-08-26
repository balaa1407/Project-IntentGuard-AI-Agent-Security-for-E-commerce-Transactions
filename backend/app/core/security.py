import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from jose import jwt, JWTError
from backend.app.core.config import settings


def get_password_hash(password: str) -> str:
    """Secure PBKDF2-HMAC-SHA256 password hash with unique random salt."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return base64.b64encode(salt + key).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time verification of PBKDF2-HMAC-SHA256 password."""
    try:
        decoded = base64.b64decode(hashed_password.encode("ascii"))
        salt = decoded[:16]
        key = decoded[16:]
        new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False


def create_access_token(subject: str, role: str = "security_operator", expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": subject,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def canonical_json_bytes(data: Any) -> bytes:
    """Produces deterministic canonical JSON serialization for cryptographic hashing."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str).encode("utf-8")


def compute_canonical_sha256(data: Any) -> str:
    """Returns SHA-256 digest of canonicalized JSON object."""
    return hashlib.sha256(canonical_json_bytes(data)).hexdigest()


def compute_hmac_signature(message: str) -> str:
    """Returns HMAC-SHA256 signature using the server secret key."""
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def verify_hmac_signature(message: str, expected_signature: str) -> bool:
    """Constant-time verification of HMAC-SHA256 signature."""
    actual_signature = compute_hmac_signature(message)
    return hmac.compare_digest(actual_signature, expected_signature)
