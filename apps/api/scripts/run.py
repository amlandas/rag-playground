from __future__ import annotations

import argparse
import subprocess

import setup_venv

COMMANDS = {
    "dev": ["-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
    "test": ["-m", "pytest"],
    "lint": ["-m", "ruff", "check", "app", "tests"],
    "typecheck": ["-m", "mypy", "app"]
}


def run_command(args: list[str]) -> None:
    subprocess.check_call([str(setup_venv.VENV_PYTHON), *args])


def handle_fmt(extra: list[str]) -> None:
    targets = ["app", "tests"]
    run_command(["-m", "ruff", "check", *targets, "--fix", *extra])
    run_command(["-m", "black", *targets])


def main() -> None:
    parser = argparse.ArgumentParser(description="Run FastAPI app helper commands inside the local venv.")
    parser.add_argument("task", choices=["dev", "test", "fmt", "lint", "typecheck"], help="Task to execute")
    parser.add_argument("extra", nargs=argparse.REMAINDER, help="Extra args passed to the underlying tool")
    parsed = parser.parse_args()

    setup_venv.main()

    if parsed.task == "fmt":
        handle_fmt(parsed.extra)
    else:
        base = COMMANDS[parsed.task]
        run_command([*base, *parsed.extra])


if __name__ == "__main__":
    main()
