from __future__ import annotations

import os
import subprocess
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENV_DIR = ROOT / ".venv"
PYTHON_DIR = "Scripts" if os.name == "nt" else "bin"
VENV_PYTHON = VENV_DIR / PYTHON_DIR / "python"
STAMP_FILE = VENV_DIR / ".requirements-installed"


def ensure_venv() -> None:
    if not VENV_DIR.exists():
        print("[api] creating virtual environment at", VENV_DIR)
        venv.create(VENV_DIR, with_pip=True)

    if not VENV_PYTHON.exists():
        raise RuntimeError("virtual environment python binary missing; recreate the venv")


def install_requirements(force: bool = False) -> None:
    requirements = ROOT / "requirements-dev.txt"
    marker_value = str(requirements.stat().st_mtime_ns)

    if not force and STAMP_FILE.exists() and STAMP_FILE.read_text() == marker_value:
        return

    subprocess.check_call([str(VENV_PYTHON), "-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools"])
    subprocess.check_call([str(VENV_PYTHON), "-m", "pip", "install", "-r", str(requirements)])
    STAMP_FILE.write_text(marker_value)


def main(force: bool = False) -> None:
    ensure_venv()
    install_requirements(force=force)


if __name__ == "__main__":
    main()
