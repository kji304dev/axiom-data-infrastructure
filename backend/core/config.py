import logging
import os

LOG_LEVEL = os.getenv("ADI_LOG_LEVEL", "INFO").upper()
MAX_RETRIES = 2


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
