#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "livewire.git"
RUNS = ROOT / ".runs"
PR_PATTERN = re.compile(r"^https://github\.com/livewire/livewire/pull/(?P<number>[1-9][0-9]*)/?$")
ENVIRONMENTS = ("before", "original", "reconstruction")


class ReconstructionError(RuntimeError):
    pass


def execute(
    command: list[str],
    *,
    cwd: pathlib.Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=cwd or ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode:
        rendered = " ".join(command)
        detail = result.stderr.strip() or result.stdout.strip()
        raise ReconstructionError(f"{rendered} failed: {detail}")
    return result


def parse_pr_url(value: str) -> int:
    match = PR_PATTERN.fullmatch(value.strip())
    if not match:
        raise ReconstructionError("Expected https://github.com/livewire/livewire/pull/<number>")
    return int(match.group("number"))


def ensure_cache() -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    if not CACHE.exists():
        execute([
            "git",
            "clone",
            "--bare",
            "--filter=blob:none",
            "https://github.com/livewire/livewire.git",
            str(CACHE),
        ])
    execute(["git", f"--git-dir={CACHE}", "remote", "set-url", "origin", "https://github.com/livewire/livewire.git"])


def git_cache(*arguments: str) -> str:
    return execute(["git", f"--git-dir={CACHE}", *arguments]).stdout.strip()


def gh_pr(number: int) -> dict[str, Any]:
    fields = ",".join(
        [
            "number",
            "title",
            "body",
            "url",
            "baseRefName",
            "baseRefOid",
            "headRefName",
            "headRefOid",
            "author",
            "files",
            "commits",
            "closingIssuesReferences",
        ]
    )
    output = execute([
        "gh",
        "pr",
        "view",
        str(number),
        "--repo",
        "livewire/livewire",
        "--json",
        fields,
    ]).stdout
    return json.loads(output)


def run_identity(number: int, head_sha: str, attempt: int = 1) -> str:
    base = f"livewire-{number}-{head_sha[:12]}"
    return base if attempt == 1 else f"{base}-a{attempt}"


def next_attempt(number: int, head_sha: str) -> tuple[str, int]:
    attempt = 1
    while (RUNS / run_identity(number, head_sha, attempt)).exists():
        attempt += 1
    return run_identity(number, head_sha, attempt), attempt


def set_current(run_dir: pathlib.Path) -> None:
    RUNS.mkdir(parents=True, exist_ok=True)
    current = RUNS / "current"
    if current.is_symlink() or current.is_file():
        current.unlink()
    elif current.exists():
        shutil.rmtree(current)
    current.symlink_to(run_dir.name, target_is_directory=True)


def current_run() -> pathlib.Path:
    current = RUNS / "current"
    if not current.exists():
        raise ReconstructionError("No current run. Use `./scripts/reconstruct prepare <pr-url>` first.")
    return current.resolve()


def read_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def write_json(path: pathlib.Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=False) + "\n")
    temporary.replace(path)


def category_for(path: str) -> str:
    lowered = path.lower()
    evidence_markers = ("test", "tests/", "fixture", "fixtures/", "snapshot", "snapshots/")
    return "evidence" if any(marker in lowered for marker in evidence_markers) else "production"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def diff_entries(
    from_sha: str,
    to_sha: str,
    kind: str,
    label: str,
    id_prefix: str | None = None,
) -> list[dict[str, Any]]:
    if from_sha == to_sha:
        return []
    names = git_cache("diff", "--name-only", from_sha, to_sha).splitlines()
    entries: list[dict[str, Any]] = []
    for index, path in enumerate(filter(None, names), start=1):
        patch = git_cache("diff", "--binary", from_sha, to_sha, "--", path)
        if not patch:
            continue
        entries.append(
            {
                "id": f"{id_prefix or kind}-{index}-{slug(path)}",
                "label": f"{label} · {path}",
                "kind": kind,
                "category": category_for(path),
                "patch": patch + "\n",
            }
        )
    return entries


def collect_diffs(metadata: dict[str, Any], reconstruction_head: str) -> list[dict[str, Any]]:
    revisions = metadata["revisions"]
    merge_base = revisions["before"]
    original = revisions["original"]
    entries = diff_entries(merge_base, original, "original", "Submitted PR")
    entries += diff_entries(merge_base, reconstruction_head, "reconstruction", "Reconstruction")

    reconstruction_path = pathlib.Path(metadata["paths"]["reconstruction"])
    commits = execute(
        ["git", "rev-list", "--reverse", f"{merge_base}..{reconstruction_head}"],
        cwd=reconstruction_path,
    ).stdout.splitlines()
    for step, commit in enumerate(filter(None, commits), start=1):
        parent = execute(["git", "rev-parse", f"{commit}^"], cwd=reconstruction_path).stdout.strip()
        subject = execute(["git", "show", "-s", "--format=%s", commit], cwd=reconstruction_path).stdout.strip()
        step_entries = diff_entries(parent, commit, "step", f"Step {step}: {subject}", f"step-{step}")
        for entry in step_entries:
            entry["reconstruction_commit"] = commit
        entries += step_entries

    entries += diff_entries(original, reconstruction_head, "comparison", "Original vs reconstruction")
    return entries


def worktree_changes(path: pathlib.Path) -> set[str]:
    tracked = execute(["git", "diff", "HEAD", "--name-only", "--"], cwd=path).stdout.splitlines()
    untracked = execute(
        ["git", "ls-files", "--others", "--exclude-standard"],
        cwd=path,
    ).stdout.splitlines()
    return set(filter(None, tracked + untracked))


def validate_worktrees(run_dir: pathlib.Path, *, allow_reconstruction_ahead: bool = False) -> None:
    metadata = read_json(run_dir / "metadata.json")
    overlay_path = run_dir / "reproduction-overlay.json"
    overlay = read_json(overlay_path).get("files", []) if overlay_path.exists() else []
    if not isinstance(overlay, list) or not all(isinstance(path, str) for path in overlay):
        raise ReconstructionError("reproduction-overlay.json must contain a list of file paths")
    allowed_overlay = set(overlay)

    paths: dict[str, pathlib.Path] = {}
    for environment in ENVIRONMENTS:
        expected_path = (run_dir / "targets" / environment).resolve()
        configured_path = pathlib.Path(metadata["paths"][environment]).resolve()
        if configured_path != expected_path or not (configured_path / ".git").exists():
            raise ReconstructionError(f"{environment} worktree is missing or does not belong to this run")
        paths[environment] = configured_path

    expected_heads = {
        "before": metadata["revisions"]["before"],
        "original": metadata["revisions"]["original"],
        "reconstruction": metadata["revisions"]["reconstruction"],
    }
    for environment, path in paths.items():
        head = execute(["git", "rev-parse", "HEAD"], cwd=path).stdout.strip()
        if environment == "reconstruction" and allow_reconstruction_ahead:
            ancestor = execute(
                ["git", "merge-base", "--is-ancestor", metadata["revisions"]["before"], head],
                cwd=path,
                check=False,
            )
            if ancestor.returncode:
                raise ReconstructionError("reconstruction HEAD must descend from the recorded merge base")
        elif head != expected_heads[environment]:
            instruction = "Run `./scripts/reconstruct diffs` first." if environment == "reconstruction" else "Prepare a new run."
            raise ReconstructionError(f"{environment} HEAD does not match its recorded revision. {instruction}")

        staged = set(
            filter(
                None,
                execute(["git", "diff", "--cached", "--name-only", "--"], cwd=path).stdout.splitlines(),
            )
        )
        if staged:
            raise ReconstructionError(f"{environment} contains staged changes: {', '.join(sorted(staged))}")
        permitted = allowed_overlay if environment in ("before", "reconstruction") else set()
        unexpected = worktree_changes(path) - permitted
        if unexpected:
            raise ReconstructionError(f"{environment} contains unrecorded changes: {', '.join(sorted(unexpected))}")

    original = paths["original"]
    for relative in allowed_overlay:
        source = original / relative
        if not source.is_file():
            raise ReconstructionError(f"recorded overlay source is missing from Original: {relative}")
        for environment in ("before", "reconstruction"):
            destination = paths[environment] / relative
            if not destination.is_file() or destination.read_bytes() != source.read_bytes():
                raise ReconstructionError(f"{environment} overlay no longer matches Original: {relative}")


def validate_reusable_run(run_dir: pathlib.Path, number: int, head_sha: str, merge_base: str) -> bool:
    try:
        metadata = read_json(run_dir / "metadata.json")
        manifest = read_json(run_dir / "run.json")
        validate_manifest(manifest)
        validate_worktrees(run_dir)
    except (KeyError, OSError, json.JSONDecodeError, ReconstructionError) as error:
        raise ReconstructionError(
            f"Existing run {run_dir.name} is incomplete or inconsistent ({error}). "
            "Use `./scripts/reconstruct prepare <pr-url> --rebuild`."
        ) from error

    if metadata["target"]["pull_request"] != number or metadata["revisions"]["original"] != head_sha:
        raise ReconstructionError(f"Existing run {run_dir.name} does not match the requested pull request head")
    return metadata["revisions"]["before"] == merge_base


def initial_manifest(metadata: dict[str, Any]) -> dict[str, Any]:
    revisions = metadata["revisions"]
    return {
        "schema_version": 1,
        "run": metadata["run"],
        "target": metadata["target"],
        "pr": {
            "number": metadata["target"]["pull_request"],
            "title": metadata["pull_request"]["title"],
            "source": "PR description, changed tests, and production diff",
            "confidence": "low",
        },
        "revisions": {
            "base": revisions["before"],
            "head": revisions["original"],
            "reconstruction": revisions["reconstruction"],
        },
        "review_status": "candidate",
        "evidence": [
            {
                "environment": environment,
                "status": "skipped",
                "assertion": "Focused reproduction has not run yet.",
                "explanation": "The worktree is prepared and awaiting executable evidence.",
            }
            for environment in ENVIRONMENTS
        ],
        "environments": [
            {
                "id": environment,
                "label": environment.title(),
                "sha": revisions[environment],
                "description": {
                    "before": "Merge base",
                    "original": "Submitted pull request",
                    "reconstruction": "Independent reconstruction",
                }[environment],
            }
            for environment in ENVIRONMENTS
        ],
        "stories": [],
        "diffs": collect_diffs(metadata, revisions["reconstruction"]),
        "uncertainties": ["The problem has not been reproduced yet."],
        "unjustified_production_changes": [],
        "learning_events": [],
        "actions": [],
    }


def prepare(pr_url: str, rebuild: bool) -> pathlib.Path:
    number = parse_pr_url(pr_url)
    ensure_cache()
    pull_request = gh_pr(number)
    base_ref = pull_request["baseRefName"]
    git_cache(
        "fetch",
        "--force",
        "origin",
        f"+refs/heads/{base_ref}:refs/heads/{base_ref}",
        f"+refs/pull/{number}/head:refs/pull/{number}/head",
    )
    base_sha = pull_request["baseRefOid"]
    head_sha = git_cache("rev-parse", f"refs/pull/{number}/head")
    if head_sha != pull_request["headRefOid"]:
        raise ReconstructionError("Fetched PR head does not match GitHub metadata; retry the run.")
    merge_base = git_cache("merge-base", base_sha, head_sha)

    default_id = run_identity(number, head_sha)
    if not rebuild:
        attempt = 1
        while (RUNS / run_identity(number, head_sha, attempt)).exists():
            run_dir = RUNS / run_identity(number, head_sha, attempt)
            if validate_reusable_run(run_dir, number, head_sha, merge_base):
                set_current(run_dir)
                return run_dir
            attempt += 1

    run_id, attempt = next_attempt(number, head_sha) if rebuild or (RUNS / default_id).exists() else (default_id, 1)
    run_dir = RUNS / run_id
    targets = run_dir / "targets"
    for directory in (targets, run_dir / "apps", run_dir / "evidence", run_dir / "learning"):
        directory.mkdir(parents=True, exist_ok=True)

    before_path = targets / "before"
    original_path = targets / "original"
    reconstruction_path = targets / "reconstruction"
    branch = f"reconstruction/{run_id}"
    git_cache("worktree", "add", "--detach", str(before_path), merge_base)
    git_cache("worktree", "add", "--detach", str(original_path), head_sha)
    git_cache("branch", branch, merge_base)
    git_cache("worktree", "add", str(reconstruction_path), branch)

    files = [item["path"] for item in pull_request.get("files", [])]
    metadata = {
        "schema_version": 1,
        "run": {
            "id": run_id,
            "attempt": attempt,
            "status": "prepared",
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        },
        "target": {
            "repository": "livewire/livewire",
            "pull_request": number,
            "url": pull_request["url"],
        },
        "pull_request": {
            "title": pull_request["title"],
            "body": pull_request.get("body") or "",
            "author": (pull_request.get("author") or {}).get("login"),
            "base_ref": base_ref,
            "head_ref": pull_request["headRefName"],
            "changed_files": files,
            "commits": pull_request.get("commits", []),
            "closing_issues": pull_request.get("closingIssuesReferences", []),
        },
        "revisions": {
            "base_ref": base_sha,
            "before": merge_base,
            "original": head_sha,
            "reconstruction": merge_base,
        },
        "paths": {environment: str(targets / environment) for environment in ENVIRONMENTS},
    }
    write_json(run_dir / "metadata.json", metadata)
    write_json(run_dir / "run.json", initial_manifest(metadata))
    set_current(run_dir)
    return run_dir


def overlay_changed_tests(run_dir: pathlib.Path) -> list[str]:
    validate_worktrees(run_dir)
    metadata = read_json(run_dir / "metadata.json")
    changed = metadata["pull_request"]["changed_files"]
    test_paths = [path for path in changed if category_for(path) == "evidence"]
    original = pathlib.Path(metadata["paths"]["original"])
    copied: list[str] = []
    for path in test_paths:
        source = original / path
        if not source.is_file():
            continue
        for environment in ("before", "reconstruction"):
            destination = pathlib.Path(metadata["paths"][environment]) / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        copied.append(path)
    write_json(run_dir / "reproduction-overlay.json", {"source": "submitted head", "files": copied})
    return copied


def refresh_diffs(run_dir: pathlib.Path) -> dict[str, Any]:
    validate_worktrees(run_dir, allow_reconstruction_ahead=True)
    metadata = read_json(run_dir / "metadata.json")
    manifest = read_json(run_dir / "run.json")
    reconstruction_path = pathlib.Path(metadata["paths"]["reconstruction"])
    reconstruction_head = execute(["git", "rev-parse", "HEAD"], cwd=reconstruction_path).stdout.strip()
    metadata["revisions"]["reconstruction"] = reconstruction_head
    manifest["revisions"]["reconstruction"] = reconstruction_head
    for environment in manifest["environments"]:
        if environment["id"] == "reconstruction":
            environment["sha"] = reconstruction_head
    manifest["diffs"] = collect_diffs(metadata, reconstruction_head)
    write_json(run_dir / "metadata.json", metadata)
    write_json(run_dir / "run.json", manifest)
    return manifest


def validate_manifest(manifest: dict[str, Any]) -> None:
    if manifest.get("schema_version") != 1:
        raise ReconstructionError("run.json schema_version must be 1")
    for key in (
        "pr",
        "revisions",
        "evidence",
        "environments",
        "stories",
        "diffs",
        "uncertainties",
        "unjustified_production_changes",
    ):
        if key not in manifest:
            raise ReconstructionError(f"run.json is missing {key}")
    environments = {item.get("id") for item in manifest["environments"]}
    if environments != set(ENVIRONMENTS):
        raise ReconstructionError("run.json must define Before, Original, and Reconstruction environments")
    evidence = {item.get("environment") for item in manifest["evidence"]}
    if evidence != set(ENVIRONMENTS):
        raise ReconstructionError("run.json must contain evidence for all three environments")
    diff_ids = [item.get("id") for item in manifest["diffs"]]
    if len(diff_ids) != len(set(diff_ids)):
        raise ReconstructionError("run.json diff IDs must be unique")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepare and maintain a Livewire PR reconstruction run.")
    subcommands = parser.add_subparsers(dest="command", required=True)
    prepare_parser = subcommands.add_parser("prepare")
    prepare_parser.add_argument("pr_url")
    prepare_parser.add_argument("--rebuild", action="store_true")
    subcommands.add_parser("overlay-tests")
    subcommands.add_parser("diffs")
    subcommands.add_parser("validate")
    subcommands.add_parser("status")
    args = parser.parse_args(argv)

    try:
        if args.command == "prepare":
            run_dir = prepare(args.pr_url, args.rebuild)
            print(json.dumps({"run": run_dir.name, "path": str(run_dir)}, indent=2))
        elif args.command == "overlay-tests":
            print(json.dumps({"files": overlay_changed_tests(current_run())}, indent=2))
        elif args.command == "diffs":
            manifest = refresh_diffs(current_run())
            print(json.dumps({"diffs": len(manifest["diffs"]), "reconstruction": manifest["revisions"]["reconstruction"]}, indent=2))
        elif args.command == "validate":
            validate_manifest(json.loads((current_run() / "run.json").read_text()))
            print("run.json is valid")
        elif args.command == "status":
            print((current_run() / "metadata.json").read_text(), end="")
    except (OSError, json.JSONDecodeError, ReconstructionError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
