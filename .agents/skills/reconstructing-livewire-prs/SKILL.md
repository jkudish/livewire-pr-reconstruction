---
name: reconstructing-livewire-prs
description: Reconstruct a livewire/livewire pull request from its observable behavior, prove Before/Submitted PR/Reconstruction, and author the review package. Use after receiving a public Livewire PR URL.
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
- **Submitted PR**: the exact submitted PR head. Its internal environment ID remains `original`.
- **Reconstruction**: the merge base plus an independently authored causal commit sequence.

Never implement in Submitted PR. Do not copy production changes from Submitted PR into Reconstruction. Changed tests may be overlaid because they are evidence, not the proposed solution.

## Preserve the blind reconstruction boundary

Wear two hats in sequence. Do not compare while reconstructing.

During the blind reconstruction phase, use only:

- the merge-base code;
- PR or issue prose describing the problem;
- changed or newly authored tests as behavioral evidence;
- the Before reproduction and surrounding base-code ownership patterns.

Do not inspect the submitted production diff, submitted implementation, submitted commit history, Submitted PR playground, or post-base code until the reconstruction solution is committed. Prefer a fresh Orb or agent context that receives a behavior brief and base revision without the PR number or head SHA.

After committing the reconstruction, enter the comparison phase:

1. Run the focused evidence against Submitted PR and Reconstruction.
2. Inspect the submitted production diff and commit history.
3. Compare final production code and explain material agreement or disagreement.
4. Reproduce user-visible behavior in all three playgrounds when it adds understanding.

If the submitted implementation was visible before the reconstruction was committed, label the result as an informed reconstruction. Never describe it as blind or independent convergence.

## Understand before explaining

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
Submitted PR    PASS
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

Author `summary` first. It must explain in human language:

- the user-visible or framework-level problem;
- how the submitted PR attempts to fix it;
- the reconstruction’s conclusion;
- how the submitted PR differs from the reconstruction;
- short reproduction steps when an interactive playground exists.

For every story explain:

1. what was wrong;
2. what changed;
3. why that change is necessary;
4. what proves it.

Attach each story only to the diff entries that implement it. Call out any production change that lacks evidence or a causal explanation.

The Review Portal must show:

- linked PR number and title;
- the problem, submitted fix, and reconstruction conclusion before implementation detail;
- Before/Submitted PR/Reconstruction evidence, with screenshots and logs in clearly labeled disclosures;
- all three interactive environment portals in one tabbed viewer, with direct Portal links;
- causal reconstruction steps;
- curated Pierre diffs for Base→Submitted PR, Base→Reconstruction, each step, and Submitted PR→Reconstruction, collapsed until requested;
- only non-empty uncertainties and unjustified production changes;
- explicit GitHub actions only when the reviewer invokes them.

Amp Changes remains the raw escape hatch, not the primary explanation.

## Complete the package

Start all four supervised portals:

```bash
amp orb services ensure
```

Exercise representative behavior in each environment and inspect the Review Portal at desktop and mobile widths. Do not claim a UI behavior from a screenshot alone; execute it first, then use the screenshot as supporting evidence.

Capture durable corrections and accepted/rejected outcomes in the run's `learning` directory. Current executable evidence always outranks learned precedent. Caleb's explicit correction outranks inferred preferences.
