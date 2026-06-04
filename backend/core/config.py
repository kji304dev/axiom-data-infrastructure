import os

MAX_RETRIES = 2

APP_ENV = os.getenv("APP_ENV", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", os.getenv("ADI_LOG_LEVEL", "INFO")).upper()
ADI_ENGINE_VERSION = os.getenv("ADI_ENGINE_VERSION", "0.1.0")
