import sys
from pathlib import Path

# Ensure workspace root is always in sys.path so "backend.app" imports always work
_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))
