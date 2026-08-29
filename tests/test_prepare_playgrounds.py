from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

SCRIPTS = pathlib.Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
MODULE_PATH = SCRIPTS / "prepare_playgrounds.py"
SPEC = importlib.util.spec_from_file_location("prepare_playgrounds", MODULE_PATH)
assert SPEC and SPEC.loader
prepare_playgrounds = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prepare_playgrounds)


class PreparePlaygroundsTests(unittest.TestCase):
    def test_missing_interactive_fixture_keeps_test_backed_review_runnable(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            run = root / "run"
            run.mkdir()
            template = root / "template"
            template.mkdir()
            (template / "artisan").touch()
            (run / "metadata.json").write_text(
                json.dumps({"target": {"pull_request": 99999}})
            )

            output = io.StringIO()
            with (
                mock.patch.object(prepare_playgrounds, "CURRENT", run),
                mock.patch.object(prepare_playgrounds, "TEMPLATE", template),
                mock.patch.object(prepare_playgrounds, "validate_worktrees"),
                contextlib.redirect_stdout(output),
            ):
                result = prepare_playgrounds.main()

        self.assertEqual(result, 0)
        self.assertIn("Continue with a test-backed review", output.getvalue())


if __name__ == "__main__":
    unittest.main()
