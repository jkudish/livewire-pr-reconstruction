#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
from typing import Any

from reconstruct import ReconstructionError, validate_worktrees

ROOT = pathlib.Path(__file__).resolve().parents[1]
CURRENT = ROOT / ".runs" / "current"
TEMPLATE = ROOT / ".cache" / "playground-template"
ENVIRONMENTS = ("before", "original", "reconstruction")
FIXTURES = {10610: ROOT / "fixtures" / "loading-period"}


def execute(command: list[str], *, cwd: pathlib.Path) -> None:
    print(f"[{cwd.name}] {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy_tree(source: pathlib.Path, destination: pathlib.Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    subprocess.run(["cp", "-a", "--reflink=auto", f"{source}/.", str(destination)], check=True)


def configure_composer(app: pathlib.Path, target: pathlib.Path) -> None:
    composer_path = app / "composer.json"
    composer: dict[str, Any] = json.loads(composer_path.read_text())
    relative_target = os.path.relpath(target, app)
    composer["repositories"] = [
        {"type": "path", "url": relative_target, "options": {"symlink": True}}
    ]
    composer.setdefault("require", {})["livewire/livewire"] = "@dev"
    composer["minimum-stability"] = "dev"
    composer["prefer-stable"] = True
    composer_path.write_text(json.dumps(composer, indent=4) + "\n")


def set_env_value(path: pathlib.Path, key: str, value: str) -> None:
    lines = path.read_text().splitlines()
    setting = f"{key}={value}"
    updated = [setting if line.startswith(f"{key}=") else line for line in lines]
    if not any(line.startswith(f"{key}=") for line in lines):
        updated.append(setting)
    path.write_text("\n".join(updated) + "\n")


def chrome_binary() -> pathlib.Path:
    configured = os.environ.get("CHROME_BINARY")
    candidates = [pathlib.Path(configured)] if configured else []
    candidates += sorted(
        (pathlib.Path.home() / ".agent-browser" / "browsers").glob("chrome-*/chrome"),
        reverse=True,
    )
    candidates += [pathlib.Path("/usr/bin/google-chrome"), pathlib.Path("/usr/bin/chromium")]
    for candidate in candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise RuntimeError("Chrome was not found. Run `agent-browser install --with-deps` first.")


def install_target_dependencies(targets: dict[str, pathlib.Path]) -> None:
    first = targets["before"]
    execute(["composer", "install", "--no-interaction", "--prefer-dist", "--no-progress"], cwd=first)
    execute(["npm", "ci", "--no-audit", "--no-fund"], cwd=first)

    composer_hash = digest(first / "composer.json")
    package_hash = digest(first / "package-lock.json")
    for state in ("original", "reconstruction"):
        target = targets[state]
        if digest(target / "composer.json") == composer_hash:
            copy_tree(first / "vendor", target / "vendor")
            execute(["composer", "dump-autoload", "--no-interaction"], cwd=target)
        else:
            execute(["composer", "install", "--no-interaction", "--prefer-dist", "--no-progress"], cwd=target)
        if digest(target / "package-lock.json") == package_hash:
            copy_tree(first / "node_modules", target / "node_modules")
        else:
            execute(["npm", "ci", "--no-audit", "--no-fund"], cwd=target)

    chrome = chrome_binary()
    for target in targets.values():
        execute(["npm", "run", "build"], cwd=target)
        execute(
            [
                "php",
                "vendor/bin/dusk-updater",
                "detect",
                "--chrome-dir",
                str(chrome),
                "--auto-update",
                "--no-interaction",
            ],
            cwd=target,
        )


def main() -> int:
    if not CURRENT.exists():
        print("error: prepare a reconstruction run first", file=sys.stderr)
        return 1
    if not (TEMPLATE / "artisan").is_file():
        print("error: run ./.agents/setup first", file=sys.stderr)
        return 1

    run_dir = CURRENT.resolve()
    try:
        validate_worktrees(run_dir)
    except ReconstructionError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    metadata = json.loads((run_dir / "metadata.json").read_text())
    pull_request = metadata["target"]["pull_request"]
    fixture = FIXTURES.get(pull_request)
    if fixture is None:
        print(
            f"Skipped interactive playgrounds: no fixture exists for Livewire PR #{pull_request}. "
            "Continue with a test-backed review."
        )
        return 0
    targets = {state: pathlib.Path(metadata["paths"][state]) for state in ENVIRONMENTS}
    install_target_dependencies(targets)

    for state, target in targets.items():
        app = run_dir / "apps" / state
        if app.exists():
            shutil.rmtree(app)
        copy_tree(TEMPLATE, app)
        configure_composer(app, target)
        copy_tree(fixture, app)
        env_path = app / ".env"
        if not env_path.exists():
            shutil.copy2(app / ".env.example", env_path)
        set_env_value(env_path, "SESSION_COOKIE", f"livewire_review_{state}_session")
        database = app / "database" / "database.sqlite"
        database.touch()
        execute(
            [
                "composer",
                "update",
                "livewire/livewire",
                "--with-all-dependencies",
                "--no-interaction",
                "--prefer-dist",
                "--no-progress",
            ],
            cwd=app,
        )
        execute(["php", "artisan", "key:generate", "--force"], cwd=app)
        execute(["php", "artisan", "optimize:clear"], cwd=app)
        (app / ".reconstruction-target").write_text(target.as_posix() + "\n")

    print(f"Prepared playgrounds for {run_dir.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
