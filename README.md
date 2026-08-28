# Livewire PR Reconstruction

Reconstructs a Livewire pull request inside an Amp Orb so a maintainer can see:

1. **Before** — the merge base with the focused reproduction.
2. **Submitted PR** — the exact pull request head against the same behavior.
3. **Reconstruction** — the smallest independently rebuilt complete solution.
4. **Review** — one page that leads with the problem, fix, and conclusion, then exposes the three environments, proof, causal explanation, and curated Pierre diffs on demand.

The first proof target is [livewire/livewire#10610](https://github.com/livewire/livewire/pull/10610).

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

The Review Portal reads the current run automatically and injects all three Amp Portal URLs. It reverse-proxies those environments into one same-origin, tabbed viewer while preserving each direct Portal. With no prepared run it falls back to the checked-in reconstruction of PR #10610. This first vertical slice includes an interactive playground fixture only for #10610; other PRs can be ingested and analyzed, but playground preparation stops honestly until a matching reproduction is authored.

## Development

```bash
./.agents/setup
python3 -m unittest discover -s tests -v
npm --prefix review-portal run typecheck
npm --prefix review-portal run build
```

This is a standalone product for Caleb's Livewire workflow. Other review systems may inspire individual ideas, but no runtime, memory, or data store is shared.
