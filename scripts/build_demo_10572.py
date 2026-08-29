#!/usr/bin/env python3
from __future__ import annotations

import difflib
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "review-portal" / "public" / "run.json"
REPOSITORY = "https://github.com/livewire/livewire"
PATH = "src/Mechanisms/PersistentMiddleware/PersistentMiddleware.php"
BASE = "06e8b11451c4bfce73a6aef95bfe6fbc813dfbb4"
SUBMITTED = "873c6f7dddb6e6d1a9c8fea4b1826f545379b3d4"
FOLLOW_UP_BASE = "ed482026c93839bf50a90d2da60b4cbd345d242f"
FOLLOW_UP = "260ee4c45b552672b42a6ee618cb01a61a9c8676"


def source_at(revision: str) -> str:
    request = urllib.request.Request(
        f"https://raw.githubusercontent.com/livewire/livewire/{revision}/{PATH}",
        headers={"User-Agent": "livewire-pr-reconstruction-demo"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode()


def replace_once(source: str, before: str, after: str) -> str:
    if source.count(before) != 1:
        raise RuntimeError(f"Expected one exact source fragment, found {source.count(before)}")
    return source.replace(before, after, 1)


def make_blind_level_one(base: str) -> str:
    result = replace_once(
        base,
        "use Illuminate\\Database\\Eloquent\\Model;\n",
        "use Illuminate\\Database\\Eloquent\\Model;\nuse Illuminate\\Database\\Eloquent\\ModelNotFoundException;\n",
    )
    return replace_once(
        result,
        "        Utils::applyMiddleware($request, $middleware);\n",
        "        try {\n"
        "            Utils::applyMiddleware($request, $middleware);\n"
        "        } catch (ModelNotFoundException $e) {\n"
        "            // The component may have been rendered by a custom 404 page.\n"
        "        }\n",
    )


def make_blind_level_two(base: str) -> str:
    result = replace_once(
        base,
        "use Illuminate\\Database\\Eloquent\\Model;\n",
        "use Illuminate\\Contracts\\Routing\\UrlRoutable;\nuse Illuminate\\Database\\Eloquent\\Model;\n",
    )
    result = replace_once(
        result,
        "    protected $resolvedRouteModels = [];\n",
        "    protected $resolvedRouteModels = [];\n    protected $missingRouteBindings = [];\n",
    )
    result = replace_once(
        result,
        "            $context->addMemo('method', $method);\n",
        "            $context->addMemo('method', $method);\n\n"
        "            if ($this->missingRouteBindings) {\n"
        "                $context->addMemo('missingRouteBindings', $this->missingRouteBindings);\n"
        "            }\n",
    )
    result = replace_once(
        result,
        "            $this->resolvedRouteModels = [];\n",
        "            $this->resolvedRouteModels = [];\n            $this->missingRouteBindings = [];\n",
    )
    result = replace_once(
        result,
        "        return [request()->path(), request()->method()];\n",
        "        $this->missingRouteBindings = $this->requestMissingRouteBindings();\n\n"
        "        return [request()->path(), request()->method()];\n",
    )
    result = replace_once(
        result,
        "        $this->method = $snapshot['memo']['method'];\n    }\n\n"
        "    protected function applyPersistentMiddleware()\n",
        "        $this->method = $snapshot['memo']['method'];\n"
        "        $this->missingRouteBindings = $snapshot['memo']['missingRouteBindings'] ?? [];\n"
        "    }\n\n"
        "    protected function requestMissingRouteBindings()\n"
        "    {\n"
        "        if (! $route = request()->route()) return [];\n\n"
        "        $parameters = $route->parameters();\n"
        "        $missing = [];\n\n"
        "        foreach ($route->signatureParameters(['subClass' => UrlRoutable::class]) as $parameter) {\n"
        "            $name = $parameter->getName();\n\n"
        "            if (! array_key_exists($name, $parameters)) {\n"
        "                $name = Str::snake($name);\n"
        "            }\n\n"
        "            if (array_key_exists($name, $parameters) && ! ($parameters[$name] instanceof UrlRoutable)) {\n"
        "                $missing[] = $name;\n"
        "            }\n"
        "        }\n\n"
        "        return $missing;\n"
        "    }\n\n"
        "    protected function applyPersistentMiddleware()\n",
    )
    result = replace_once(
        result,
        "        $routeKey = $this->method . '|' . $this->path;\n",
        "        $routeKey = $this->method . '|' . $this->path . '|' . implode(',', $this->missingRouteBindings);\n",
    )
    return replace_once(
        result,
        "        Utils::applyMiddleware($request, $middleware);\n",
        "        foreach ($this->missingRouteBindings as $parameter) {\n"
        "            $request->route()->forgetParameter($parameter);\n"
        "        }\n\n"
        "        Utils::applyMiddleware($request, $middleware);\n",
    )


def patch(before: str, after: str) -> str:
    lines = difflib.unified_diff(
        before.splitlines(keepends=True),
        after.splitlines(keepends=True),
        fromfile=f"a/{PATH}",
        tofile=f"b/{PATH}",
        n=8,
    )
    return f"diff --git a/{PATH} b/{PATH}\n" + "".join(lines)


def blob(revision: str) -> str:
    return f"{REPOSITORY}/blob/{revision}/{PATH}"


def diff_entry(
    *,
    id: str,
    label: str,
    before: str,
    after: str,
    revision: str,
    source_links: list[dict[str, str]],
    github_url: str | None = None,
) -> dict[str, object]:
    return {
        "id": id,
        "label": label,
        "kind": "step",
        "category": "production",
        "path": PATH,
        "patch": patch(before, after),
        "source_links": source_links,
        "full_file": {
            "path": PATH,
            "revision": revision,
            "contents": after,
            **({"github_url": github_url} if github_url else {}),
        },
    }


def main() -> None:
    base = source_at(BASE)
    submitted = source_at(SUBMITTED)
    follow_up_base = source_at(FOLLOW_UP_BASE)
    follow_up = source_at(FOLLOW_UP)
    blind_level_one = make_blind_level_one(base)
    blind_level_two = make_blind_level_two(base)

    expected = {
        "base": "b0dd8a2c6c839b08ee06c81c80d51f35127d5c6e5b5bf16bc6e582aa31cf6d7e",
        "blind level one": "8b79095291634f3ee79df44431bed4f6940dea485be01e268371cf9f3e0ef48d",
        "blind level two": "0e95c123655a9d253003f9c390b89eef296ec582ce97babfdbea851a86dc2a8e",
    }
    actual = {
        "base": hashlib.sha256(base.encode()).hexdigest(),
        "blind level one": hashlib.sha256(blind_level_one.encode()).hexdigest(),
        "blind level two": hashlib.sha256(blind_level_two.encode()).hexdigest(),
    }
    if actual != expected:
        raise RuntimeError(f"Pinned demo source drifted: {actual}")

    diffs = [
        diff_entry(
            id="submitted-minimum",
            label="Submitted PR · functioning minimum",
            before=base,
            after=submitted,
            revision=SUBMITTED,
            source_links=[
                {"label": "Before", "url": blob(BASE)},
                {"label": "Submitted PR", "url": blob(SUBMITTED)},
            ],
            github_url=blob(SUBMITTED),
        ),
        diff_entry(
            id="blind-scoped-reconstruction",
            label="Blind reconstruction · scoped binding replay",
            before=blind_level_one,
            after=blind_level_two,
            revision="local-blind-level-two",
            source_links=[{"label": "Public starting point", "url": blob(BASE)}],
        ),
        diff_entry(
            id="post-reveal-provenance",
            label="Post-reveal follow-up · error-page provenance",
            before=follow_up_base,
            after=follow_up,
            revision=FOLLOW_UP,
            source_links=[
                {"label": "Before follow-up", "url": blob(FOLLOW_UP_BASE)},
                {"label": "Follow-up PR", "url": blob(FOLLOW_UP)},
            ],
            github_url=blob(FOLLOW_UP),
        ),
    ]

    manifest = {
        "schema_version": 1,
        "run": {"id": "canonical-livewire-10572"},
        "target": {
            "repository": "livewire/livewire",
            "pull_request": 10572,
            "url": f"{REPOSITORY}/pull/10572",
        },
        "pr": {
            "number": 10572,
            "title": "Fix route model binding issue that causes 404 on update route",
        },
        "summary": {
            "problem": "A custom 404 page can contain a Livewire component that looks usable. Clicking it sends an update whose saved route points back to the missing model, so Laravel returns another 404 inside Livewire’s error modal instead of running the action.",
            "submitted_fix": "Catch the missing-model exception during persistent middleware replay so the Livewire action can continue.",
            "outcome": "The five-line fix restores the interaction, but it also lets actions continue without middleware that follows model binding. A narrower blind reconstruction still cannot reliably distinguish a binding that failed from one Laravel never attempted. The safe review outcome is no framework patch.",
            "comparison": "The blind reconstruction independently rediscovered the submitted minimum, then tried to narrow it. The narrowing failed on binding order. A post-reveal provenance alternative avoids that inference but still opts marked snapshots out of route middleware replay.",
            "reproduction_steps": [],
        },
        "revisions": {
            "base": BASE,
            "head": SUBMITTED,
            "reconstruction": "local-blind-level-two",
        },
        "review_status": "verified",
        "evidence": [],
        "environments": [],
        "stories": [],
        "diffs": diffs,
        "deconstruction": {
            "intro": "The submitted change works on the reported symptom. The review question is whether it preserves Livewire’s middleware and authorization guarantees while doing so.",
            "levels": [
                {
                    "id": "minimum",
                    "label": "Level 1 · functioning minimum",
                    "title": "Catch the missing model and continue",
                    "status": "rejected",
                    "summary": "Both the submitted PR and the isolated blind trial arrive at the same small idea: catch ModelNotFoundException around persistent middleware replay. The custom 404 component can now update.",
                    "question": "When binding throws halfway through the middleware pipeline, what else did we just skip?",
                    "proof": "The focused reproduction changes from update 404 to update 200. That proves the symptom is fixed—not that continuing is safe.",
                    "output": "Reported path\nBefore: expected 200, received 404\nAfter Level 1: OK (1 test, 4 assertions)",
                    "diff_ids": ["submitted-minimum"],
                },
                {
                    "id": "fail-closed",
                    "label": "Constraint · middleware must remain fail-closed",
                    "title": "The minimum bypasses authorization",
                    "status": "rejected",
                    "summary": "The catch sits outside the middleware pipeline. Once SubstituteBindings throws, the pipeline unwinds; Livewire catches the exception and executes the component action anyway. Middleware after bindings never runs.",
                    "question": "Can a model disappear—or an authorization check deny—without the action running?",
                    "proof": "Two focused regressions fail against Level 1: a model deleted after a valid render no longer returns 404, and authorization after bindings no longer returns 403.",
                    "output": "Fail-closed checks against Level 1\nModel disappeared: expected 404, received 200\nAuthorization after bindings: expected 403, received 200",
                    "diff_ids": [],
                },
                {
                    "id": "scoped",
                    "label": "Level 2 · blind scoped reconstruction",
                    "title": "Remember only the bindings that were already missing",
                    "status": "superseded",
                    "summary": "The blind reconstruction signs inferred missing parameter names into the component snapshot. On update it removes only those parameters, then lets the rest of the middleware pipeline run normally. Four initial state tests pass.",
                    "question": "Does a raw route parameter mean “binding failed,” or can it also mean “Laravel never reached this binding”?",
                    "proof": "This is locally reconstructed code, not a copy of the submitted implementation. It handles the primary case, preserves later authorization in the tested order, and remains fail-closed when a once-valid model disappears.",
                    "output": "Initial Level 2 checks\nCustom 404 component updates: 200\nModel disappears after valid render: 404\nAuthorization after bindings denies: 403\nOne valid + one missing binding: 200",
                    "diff_ids": ["blind-scoped-reconstruction"],
                },
                {
                    "id": "binding-order",
                    "label": "Counterexample · binding order",
                    "title": "The detector mistakes “not attempted” for “missing”",
                    "status": "rejected",
                    "summary": "Put the missing model first and a valid tenant-sensitive model second. Laravel throws on the first parameter and never attempts the second, so both remain raw scalars. Level 2 signs both as missing and removes both before authorization.",
                    "question": "Can downstream authorization still receive and revalidate the later tenant model?",
                    "proof": "No. The exact counterexample records both parameters as missing and leaves the authorization middleware without its resolved tenant. In this fixture it fails closed with 403; middleware that treats an absent tenant as public could fail open.",
                    "output": "Expected memo / status\n[[\"missingModel\"], 200]\n\nActual Level 2 memo / status\n[[\"missingModel\", \"availableModel\"], 403]",
                    "diff_ids": [],
                },
                {
                    "id": "post-reveal",
                    "label": "Post-reveal alternative",
                    "title": "Signed error-page provenance removes the guess—but not the policy question",
                    "status": "superseded",
                    "summary": "The follow-up design marks snapshots created while Laravel renders a route-binding error page, then skips persistent middleware replay for those snapshots. The client cannot forge the marker, and binding order no longer matters.",
                    "question": "Should a component rendered before the original route middleware completed be allowed to run with no replay of that route middleware?",
                    "proof": "The marker has trustworthy provenance, but the update handler explicitly returns before persistent middleware runs. That is a product and authorization contract change, not merely a route-binding fix.",
                    "diff_ids": ["post-reveal-provenance"],
                },
            ],
            "spectrum": {
                "minimum": "Catch ModelNotFoundException. It fixes the report in five production lines but demonstrably skips later authorization, so reject it.",
                "maximum": "Record authoritative binding-attempt and completed-middleware provenance across the initial exception render and every later update. That is a lifecycle redesign for a narrow edge case.",
                "evaporate": "Move interactive error behavior to a dedicated route or endpoint so the failed model-bound route never becomes the component’s update context.",
                "userland": "Keep the error page static, use a dedicated Alpine/fetch endpoint, redirect to a non-model-bound Livewire error route, or deliberately remove SubstituteBindings from persistent replay while accepting the documented tenancy and deletion tradeoff.",
            },
            "submitted_comparison": "The blind pass was useful precisely because it did not stop at matching the submitted five-line catch. It exposed the fail-open path, built a plausible narrower mechanism, and then disproved that mechanism with one binding-order test. The post-reveal follow-up solved provenance more honestly, but still required an explicit decision to let marked snapshots bypass route middleware replay. That made the maintainer decision clear: the complete framework solution is disproportionate; the small ones have ambiguous security semantics.",
            "decision": {
                "title": "Punt the framework change; document the userland tradeoff",
                "explanation": "Interactive Livewire components on route-binding exception pages remain unsupported at the framework level. Applications can remove SubstituteBindings from Livewire’s persistent middleware list if they deliberately accept that updates will no longer revalidate scoped or custom bindings or detect deleted route models.",
            },
        },
        "uncertainties": [],
        "unjustified_production_changes": [],
    }

    OUTPUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {len(diffs)} expandable production diffs")


if __name__ == "__main__":
    main()
