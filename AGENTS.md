# Livewire PR Reconstruction

This repository is a standalone review product for Caleb Porzio and Livewire. It is not part of PlanMode or another review system.

## Product boundary

- A run starts from one `livewire/livewire` pull-request URL.
- Keep exact merge-base, submitted-head, and reconstruction SHAs attached to every conclusion and action.
- The same reproduction must run against Before, Original, and Reconstruction whenever compatible.
- A failing focused test is a complete reproduction.
- Continue with a clearly labelled candidate when behavior is inferable but not reproduced; never invent verification.
- GitHub write actions are supported, but only execute the action Caleb invokes against the exact reviewed head.

## Ownership

- `.agents/setup` prepares stable Orb dependencies and the reusable Livewire/Laravel world.
- `scripts/reconstruct.py` owns deterministic PR ingestion, worktrees, manifests, and diff generation.
- `.agents/skills/reconstructing-livewire-prs/SKILL.md` owns agent judgment, reconstruction, evidence, and explanation.
- `review-portal/` owns presentation and Portal actions.
- Generated runs live under `.runs/` and never enter product diffs.

## Checks

```bash
python3 -m unittest discover -s tests -v
npm --prefix review-portal run typecheck
npm --prefix review-portal run build
bash -n .agents/setup scripts/reconstruct scripts/bootstrap-livewire-world \
  scripts/prepare-playgrounds scripts/serve-environment scripts/serve-review
```
