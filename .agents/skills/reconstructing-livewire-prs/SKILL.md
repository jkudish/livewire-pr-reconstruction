---
name: reconstructing-livewire-prs
description: Reconstruct a livewire/livewire pull request from its observable behavior, prove Before/Original/Reconstruction, and author the review package. Use after receiving a public Livewire PR URL.
---

# Reconstructing Livewire PRs

Build reviewer understanding, not a second generic code review. Independently reproduce the problem, reconstruct the smallest causal solution, and explain what each change accomplishes.

## Prepare the exact revisions

Run:

```bash
./scripts/reconstruct prepare https://github.com/livewire/livewire/pull/<number>
./scripts/reconstruct overlay-tests
./scripts/prepare-playgrounds
```

The prepared run owns three immutable roles:

- **Before**: the PR merge base plus only the reproduction evidence needed to observe the bug.
- **Original**: the exact submitted PR head.
- **Reconstruction**: the merge base plus an independently authored causal commit sequence.

Never implement in Original. Do not copy production changes from Original into Reconstruction. Changed tests may be overlaid because they are evidence, not the proposed solution.

## Understand before explaining

Use evidence in this order:

1. Run changed or relevant focused tests on Before and Original.
2. Reproduce user-visible behavior in the three playgrounds when the behavior is visual or interactive.
3. Read changed tests, production diff, surrounding ownership code, linked issues, and PR prose.
4. Inspect commit history only when it clarifies intent or exposes a corrected wrong turn.

Label important claims by source and confidence. If the PR prose is weak, infer intent from executable evidence and code, then say that you inferred it.

A failing test is a valid reproduction. A browser demo is useful only when it adds understanding. Screenshots, recordings, snapshots, DOM facts, console output, or network evidence are appropriate when they prove behavior more clearly than prose.

If the issue cannot be reproduced, do not invent certainty. Continue only when the behavior can still be inferred from concrete code or evidence; mark the reconstruction as lower confidence and explain the missing proof. Stop only when Livewire cannot run or no observable behavior can be inferred.

## Reconstruct the solution

Work in `.runs/current/targets/reconstruction`.

Create one causal commit per reviewer-relevant idea. Each commit should:

- fix one necessary part of the behavior;
- exclude demonstration-only files and generated artifacts;
- use Livewire's existing ownership boundaries and patterns;
- be independently explainable in plain language.

Prefer the smallest sufficient reconstruction. A reconstruction may match the original when the original is already proportionate. It may differ when a simpler ownership model proves the same behavior.

Never stage the overlaid test accidentally with a production commit. Stage exact production paths. Add a final evidence commit only if the reconstruction genuinely needs a new or corrected test.

Run only focused browser tests; never run Livewire's complete browser suite. Follow the target checkout's own `CLAUDE.md` for setup and test commands.

## Prove all three states

The expected evidence shape is usually:

```text
Before          FAIL
Original        PASS
Reconstruction  PASS
```

Record the exact command, exit code, assertion, and a concise explanation for each environment in `.runs/current/run.json`. Use `blocked` or `skipped`, not a false pass, when evidence cannot run.

Refresh generated diffs after reconstruction commits:

```bash
./scripts/reconstruct diffs
./scripts/reconstruct validate
```

## Author the review story

Edit `.runs/current/run.json`. Keep it concise enough to scan and detailed enough to provide true sight.

For every story explain:

1. what was wrong;
2. what changed;
3. why that change is necessary;
4. what proves it.

Attach each story only to the diff entries that implement it. Call out any production change that lacks evidence or a causal explanation.

The Review Portal must show:

- the one-sentence problem and confidence/source;
- Before/Original/Reconstruction evidence;
- all three interactive environment portals;
- causal reconstruction steps;
- curated Pierre diffs for Base→Original, Base→Reconstruction, each step, and Original→Reconstruction;
- uncertainties and unjustified production changes;
- explicit GitHub actions only when the reviewer invokes them.

Amp Changes remains the raw escape hatch, not the primary explanation.

## Complete the package

Start all four supervised portals:

```bash
amp orb services ensure
```

Exercise representative behavior in each environment and inspect the Review Portal at desktop and mobile widths. Do not claim a UI behavior from a screenshot alone; execute it first, then use the screenshot as supporting evidence.

Capture durable corrections and accepted/rejected outcomes in the run's `learning` directory. Current executable evidence always outranks learned precedent. Caleb's explicit correction outranks inferred preferences.
