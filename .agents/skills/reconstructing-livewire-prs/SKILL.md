---
name: reconstructing-livewire-prs
description: Deconstructs a livewire/livewire pull request into blind functioning solution levels, attacks material disagreements after revealing the submission, and authors the review package. Use after receiving a Livewire PR URL.
---

# Reconstructing Livewire PRs

Build reviewer understanding, not a second generic code review. Independently reproduce the problem, start with the smallest functioning solution, and add only the levels required to expose constraints, wrong turns, or a justified punt.

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
4. For every material disagreement, state the one safety or correctness fact on which each mechanism depends.
5. Write and run the narrowest counterexample that could falsify each unproven fact. Include ordering, multiple-target, failure-path, authorization, and lifecycle cases only when the mechanism depends on them.
6. Revise the recommendation when a counterexample fails. Explicitly supersede the earlier conclusion instead of preserving it as an unresolved alternative.
7. Reproduce user-visible behavior in all three playgrounds when it adds understanding.

Blindness prevents anchoring; post-reveal adversarial comparison prevents confidence in a plausible but incomplete reconstruction. Do not publish the review story between these phases.

If the submitted implementation was visible before the reconstruction was committed, label the result as an informed reconstruction. Never describe it as blind or independent convergence.

## Understand before explaining

Label important claims by source and confidence. If the PR prose is weak, infer intent from executable evidence and code, then say that you inferred it.

A failing test is a valid reproduction. A browser demo is useful only when it adds understanding. Screenshots, recordings, snapshots, DOM facts, console output, or network evidence are appropriate when they prove behavior more clearly than prose.

If the issue cannot be reproduced, do not invent certainty. Continue only when the behavior can still be inferred from concrete code or evidence; mark the reconstruction as lower confidence and explain the missing proof. Stop only when Livewire cannot run or no observable behavior can be inferred.

## Build functioning solution levels

Work in `.runs/current/targets/reconstruction`.

The commit history is the primary code tour. Create levels, not slices:

- **Level 1** is the smallest functioning solution, even when patchy, incomplete, or likely to be discarded.
- After committing Level 1, use its mechanism to ask the next concrete reviewer question. Prove the strongest limitation before implementing another level.
- **Later levels** are complete functioning solutions at a different level of scope, not “model, controller, view” pieces of one predetermined implementation.
- Stop when a level is proportionate and proven, or when the evidence makes userland/punt the better result.

Each level commit should:

- pass the reproduction it claims to solve;
- exclude demonstration-only files and generated artifacts;
- use Livewire's existing ownership boundaries and patterns;
- be independently explainable in plain language;
- preserve an intentionally useful failed level rather than rewriting history after learning why it is wrong.

Always consider four outcomes in concrete Livewire terms:

1. **Minimum** — smallest patch and its known incompleteness;
2. **Maximum** — complete architectural answer and its blast radius;
3. **Evaporate** — change the surrounding world so the problem no longer occurs;
4. **Userland/punt** — solve the narrow need outside Livewire or decline the framework change.

Do not force all four into code. A reconstruction may match the submission when it is already proportionate. A successful run may end with no mergeable framework patch.

Never stage the overlaid test accidentally with a production commit. Stage exact production paths. Add a final evidence commit only if the reconstruction genuinely needs a new or corrected test.

Run only focused browser tests; never run Livewire's complete browser suite. Follow the target checkout's own `CLAUDE.md` for setup and test commands.

## Prove all three states

The minimum evidence shape is:

```text
Before                    FAILS the primary reproduction
Level 1                   PASSES the reproduction
Level 1 constraint test   PASSES or exposes why Level 1 is incomplete
Later level               PASSES every constraint it claims to solve
Submitted PR              Evaluated against the same evidence
```

Record the exact command, exit code, assertion, and a concise explanation for each environment in `.runs/current/run.json`. Use `blocked` or `skipped`, not a false pass, when evidence cannot run.

Refresh generated diffs after reconstruction commits:

```bash
./scripts/reconstruct diffs
./scripts/reconstruct validate
```

## Author the review story

Edit `.runs/current/run.json`. Keep it concise enough to scan and detailed enough to provide true sight.

Author `summary` only after the post-reveal challenge phase. It must explain in human language:

- the user-visible or framework-level problem;
- the minimum functioning solution and what it immediately reveals;
- the next constraint and why another level is or is not justified;
- where the submitted PR sits on the minimum/maximum/evaporate/userland spectrum;
- the final conclusion, including any superseded reconstruction conclusion;
- short reproduction steps when an interactive playground exists.

For every story explain:

1. what was wrong;
2. what changed;
3. why that change is necessary;
4. what proves it.

Attach each story only to the diff entries that implement it. Call out any production change that lacks evidence or a causal explanation.

The Review Portal must show:

- linked PR number and title;
- the Level 1 production diff and decisive proof before long prose;
- each later functioning level as the next chapter, with the constraint that requires it;
- the experiential problem, submitted comparison, and final conclusion;
- Before/Submitted PR/Reconstruction evidence, with screenshots and logs in clearly labeled disclosures;
- interactive environment portals only when they improve understanding, with direct Portal links;
- curated Pierre diffs for each level, Base→Submitted PR, and Submitted PR→Reconstruction;
- only non-empty uncertainties and unjustified production changes;
- explicit GitHub actions only when the reviewer invokes them.

Amp Changes remains the raw escape hatch, not the primary explanation.

## Complete the package

When the run includes application environments, start the supervised portals:

```bash
amp orb services ensure
```

Exercise representative behavior in each environment and inspect the Review Portal at desktop and mobile widths. Do not claim a UI behavior from a screenshot alone; execute it first, then use the screenshot as supporting evidence.

Capture durable corrections and accepted/rejected outcomes in the run's `learning` directory. Current executable evidence always outranks learned precedent. Caleb's explicit correction outranks inferred preferences.
