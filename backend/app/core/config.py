import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "IntentGuard Enterprise"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = Field(default="sandbox", description="development, sandbox, or production")
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = Field(default="sqlite:///./intentguard.db", description="SQLAlchemy connection string")
    
    # Security & Cryptography
    SECRET_KEY: str = Field(default="intentguard-enterprise-dev-secret-key-32bytesmin!!", description="HMAC & JWT signing secret")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # LLM Settings (Server-side ONLY, never exposed to client)
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API key for intent extraction")
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # Policy Engine & Authorization Guardrails
    DEFAULT_CONTRACT_TTL_MINUTES: int = 120
    ENFORCE_SINGLE_PURCHASE: bool = True
    MAX_PRICE_TOLERANCE_PCT: float = 0.10  # Up to 10% deviation triggers REQUIRE_CONFIRMATION; above triggers BLOCK
    
    # Sandboxed Payment Adapter
    SANDBOX_PAYMENT_ENABLED: bool = True
    SIMULATE_GATEWAY_LATENCY_MS: int = 150
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
