# Livewire PR Reconstruction

Reconstructs a Livewire pull request inside an Amp Orb so a maintainer can see:

1. **Before** — the merge base with the focused reproduction.
2. **Submitted PR** — the exact pull request head against the same behavior.
3. **Reconstruction** — the smallest independently rebuilt complete solution.
4. **Review** — one page that leads with the problem, fix, and conclusion, then exposes the three environments, proof, causal explanation, and curated Pierre diffs on demand.

The checked-in canonical review companion is [livewire/livewire#10572](https://github.com/livewire/livewire/pull/10572). It follows the submitted minimum, the fail-closed counterexamples, the blind scoped reconstruction, the binding-order counterexample, and the final userland decision. Rebuild its pinned source and expandable diffs with:

```bash
python3 scripts/build_demo_10572.py
```

## Open the review companion in a fresh Amp Orb

Until this prototype branch is merged to `main`, clone it explicitly:

```bash
gh repo clone jkudish/livewire-pr-reconstruction livewire-pr-reconstruction -- \
  --branch build/vertical-slice --single-branch
cd livewire-pr-reconstruction
./.agents/setup
amp orb services ensure
```

Open the `review` Portal printed by the last command. The checked-in #10572 companion opens immediately; you do not need to prepare or rebuild a run first.

## Current vertical slice

```bash
./scripts/reconstruct prepare https://github.com/livewire/livewire/pull/10610
./scripts/reconstruct overlay-tests
./scripts/prepare-playgrounds
amp orb services ensure
```

The preparation command pins the exact PR head, calculates the merge base, creates three worktrees, and writes a resumable run manifest under `.runs/`. The focused changed tests are then overlaid onto Before and Reconstruction as reproduction evidence without becoming production commits.

Reconstruct in `.runs/current/targets/reconstruction`, creating one commit per causal step. Then refresh and validate the review data:

```bash
./scripts/reconstruct diffs
./scripts/reconstruct validate
```

The Review Portal opens the checked-in #10572 companion by default. Add `?run=/run.json` to review the current prepared run with all three Amp Portal URLs injected. For runs with interactive playgrounds, it reverse-proxies those environments into one same-origin, tabbed viewer while preserving each direct Portal. The first vertical slice includes an interactive playground fixture only for #10610; other PRs can be ingested and analyzed, but playground preparation stops honestly until a matching reproduction is authored.

## Development

```bash
./.agents/setup
python3 -m unittest discover -s tests -v
npm --prefix review-portal run typecheck
npm --prefix review-portal run build
bash -n .agents/setup scripts/reconstruct scripts/bootstrap-livewire-world \
  scripts/prepare-playgrounds scripts/serve-environment scripts/serve-review
```

This is a standalone product for Caleb's Livewire workflow. Other review systems may inspire individual ideas, but no runtime, memory, or data store is shared.
