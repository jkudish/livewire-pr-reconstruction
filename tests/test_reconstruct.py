from __future__ import annotations

import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest

MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "reconstruct.py"
SPEC = importlib.util.spec_from_file_location("reconstruct", MODULE_PATH)
assert SPEC and SPEC.loader
reconstruct = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reconstruct)


class ReconstructTests(unittest.TestCase):
    def make_run(self, root: pathlib.Path) -> tuple[pathlib.Path, dict[str, str]]:
        run = root / "run"
        heads: dict[str, str] = {}
        for environment in reconstruct.ENVIRONMENTS:
            target = run / "targets" / environment
            target.mkdir(parents=True)
            subprocess.run(["git", "init", "-q"], cwd=target, check=True)
            (target / "production.js").write_text("base\n")
            (target / "BrowserTest.php").write_text("submitted\n" if environment == "original" else "base\n")
            subprocess.run(["git", "add", "."], cwd=target, check=True)
            subprocess.run(
                ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "fixture"],
                cwd=target,
                check=True,
            )
            heads[environment] = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=target,
                check=True,
                text=True,
                stdout=subprocess.PIPE,
            ).stdout.strip()

        metadata = {
            "target": {"pull_request": 10610},
            "revisions": heads,
            "paths": {environment: str(run / "targets" / environment) for environment in reconstruct.ENVIRONMENTS},
        }
        manifest = {
            "schema_version": 1,
            "pr": {},
            "summary": {
                "problem": "Problem",
                "submitted_fix": "Fix",
                "outcome": "Outcome",
                "comparison": "Comparison",
                "reproduction_steps": [],
            },
            "revisions": {},
            "evidence": [{"environment": item} for item in reconstruct.ENVIRONMENTS],
            "environments": [{"id": item} for item in reconstruct.ENVIRONMENTS],
            "stories": [],
            "diffs": [],
            "uncertainties": [],
            "unjustified_production_changes": [],
        }
        reconstruct.write_json(run / "metadata.json", metadata)
        reconstruct.write_json(run / "run.json", manifest)
        reconstruct.write_json(run / "reproduction-overlay.json", {"files": ["BrowserTest.php"]})
        for environment in ("before", "reconstruction"):
            (run / "targets" / environment / "BrowserTest.php").write_text("submitted\n")
        return run, heads

    def test_parses_livewire_pull_request_url(self) -> None:
        self.assertEqual(reconstruct.parse_pr_url("https://github.com/livewire/livewire/pull/10610"), 10610)

    def test_rejects_other_repositories(self) -> None:
        with self.assertRaises(reconstruct.ReconstructionError):
            reconstruct.parse_pr_url("https://github.com/example/livewire/pull/10610")

    def test_run_identity_is_stable_and_attempt_aware(self) -> None:
        sha = "59553fcadb264748f15c1dd515c6543ea661d988"
        self.assertEqual(reconstruct.run_identity(10610, sha), "livewire-10610-59553fcadb26")
        self.assertEqual(reconstruct.run_identity(10610, sha, 2), "livewire-10610-59553fcadb26-a2")

    def test_classifies_test_and_fixture_paths_as_evidence(self) -> None:
        self.assertEqual(reconstruct.category_for("src/Feature/BrowserTest.php"), "evidence")
        self.assertEqual(reconstruct.category_for("fixtures/loading/page.blade.php"), "evidence")
        self.assertEqual(reconstruct.category_for("js/directives/wire-loading.js"), "production")

    def test_manifest_requires_all_three_environments(self) -> None:
        manifest = {
            "schema_version": 1,
            "pr": {},
            "summary": {
                "problem": "Problem",
                "submitted_fix": "Fix",
                "outcome": "Outcome",
                "comparison": "Comparison",
                "reproduction_steps": [],
            },
            "revisions": {},
            "evidence": [{"environment": item} for item in reconstruct.ENVIRONMENTS],
            "environments": [{"id": item} for item in reconstruct.ENVIRONMENTS],
            "stories": [],
            "diffs": [],
            "uncertainties": [],
            "unjustified_production_changes": [],
        }
        reconstruct.validate_manifest(manifest)
        manifest["environments"].pop()
        with self.assertRaises(reconstruct.ReconstructionError):
            reconstruct.validate_manifest(manifest)

    def test_manifest_rejects_duplicate_diff_ids(self) -> None:
        manifest = {
            "schema_version": 1,
            "pr": {},
            "summary": {
                "problem": "Problem",
                "submitted_fix": "Fix",
                "outcome": "Outcome",
                "comparison": "Comparison",
                "reproduction_steps": [],
            },
            "revisions": {},
            "evidence": [{"environment": item} for item in reconstruct.ENVIRONMENTS],
            "environments": [{"id": item} for item in reconstruct.ENVIRONMENTS],
            "stories": [],
            "diffs": [{"id": "duplicate"}, {"id": "duplicate"}],
            "uncertainties": [],
            "unjustified_production_changes": [],
        }
        with self.assertRaises(reconstruct.ReconstructionError):
            reconstruct.validate_manifest(manifest)

    def test_write_json_is_atomic_and_formatted(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = pathlib.Path(temporary) / "run.json"
            reconstruct.write_json(path, {"schema_version": 1})
            self.assertEqual(json.loads(path.read_text()), {"schema_version": 1})
            self.assertTrue(path.read_text().endswith("\n"))
            self.assertFalse(path.with_suffix(".json.tmp").exists())

    def test_worktree_validation_allows_only_exact_reproduction_overlay(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            run, _heads = self.make_run(pathlib.Path(temporary))
            reconstruct.validate_worktrees(run)
            (run / "targets" / "reconstruction" / "production.js").write_text("uncommitted\n")
            with self.assertRaisesRegex(reconstruct.ReconstructionError, "unrecorded changes: production.js"):
                reconstruct.validate_worktrees(run)

    def test_reusable_run_rejects_a_changed_merge_base(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            run, heads = self.make_run(pathlib.Path(temporary))
            self.assertTrue(reconstruct.validate_reusable_run(run, 10610, heads["original"], heads["before"]))
            self.assertFalse(reconstruct.validate_reusable_run(run, 10610, heads["original"], "new-base"))


if __name__ == "__main__":
    unittest.main()
