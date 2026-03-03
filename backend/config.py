from pathlib import Path
from typing import List

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_CANDIDATES = [
    PROJECT_ROOT / ".env",
    PROJECT_ROOT / "backend" / ".env",
]


def load_project_env() -> List[str]:
    loaded: List[str] = []
    for env_path in ENV_CANDIDATES:
        if env_path.exists():
            load_dotenv(dotenv_path=env_path, override=False)
            loaded.append(str(env_path))
    return loaded


def first_env_file() -> str | None:
    for env_path in ENV_CANDIDATES:
        if env_path.exists():
            return str(env_path)
    return None
