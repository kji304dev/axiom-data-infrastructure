import os

MAX_RETRIES = 2

APP_ENV = os.getenv("APP_ENV", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", os.getenv("ADI_LOG_LEVEL", "INFO")).upper()
ADI_ENGINE_VERSION = os.getenv("ADI_ENGINE_VERSION", "0.1.0")

DEFAULT_CORS_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def get_cors_origins() -> list[str]:
    origins = list(DEFAULT_CORS_ORIGINS)
    extra = os.getenv("ADI_CORS_ORIGINS", "")
    if extra:
        origins.extend(origin.strip() for origin in extra.split(",") if origin.strip())
    return origins
