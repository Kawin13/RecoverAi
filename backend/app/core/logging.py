import logging
import sys

def setup_logging():
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    logging_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=logging_format,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

logger = logging.getLogger("recoverai")

