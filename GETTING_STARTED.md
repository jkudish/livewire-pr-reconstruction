# Getting Started

Use this guide to run the Livewire PR Reconstruction repository in your own Amp Orb.

The first run to try is the checked-in review companion for [Livewire PR #10572](https://github.com/livewire/livewire/pull/10572). Once that works, provide another `livewire/livewire` pull request URL to start a new reconstruction.

## What you need

- An [Amp](https://ampcode.com/) account.
- The public [`jkudish/livewire-pr-reconstruction`](https://github.com/jkudish/livewire-pr-reconstruction) repository URL.
- GitHub connected in your Amp integration settings only if you want to select the repository from your GitHub picker or later perform authenticated GitHub actions. Amp can clone the public repository without a connection.
- Your own write permission on `livewire/livewire` only if you later want Amp to comment, update a branch, approve, or merge. Viewing and reconstructing public Livewire PRs does not require that permission.

You do not need PHP, Composer, Node.js, or a browser installed on your computer. The repository's `.agents/setup` prepares those inside the Orb.

## Create your Amp Project

You only need to do this once:

1. Open [Amp Projects](https://ampcode.com/projects) and select **New Project**.
2. Choose **Use an Existing Repository**.
3. Paste `https://github.com/jkudish/livewire-pr-reconstruction`, or select it from your connected GitHub repositories.
4. Choose yourself as the owner for an independent private project. Choose a workspace only when its members should share access to the project and its threads.
5. Start a new thread with **New Orb** as the executor and select the project you just created.

Amp clones the repository and runs `.agents/setup` when it prepares the first Orb. A clean-room test completed that setup in about one minute. Later threads can reuse Amp's prepared snapshot and usually start faster.

See Amp's [Orbs getting-started guide](https://ampcode.com/docs/orbs/getting-started) and [Projects documentation](https://ampcode.com/docs/projects) if you need help creating the project.

## Open the working example

Send this as the first prompt in the project:

```text
Open the checked-in review companion for Livewire PR #10572.
Start the declared Orb services and give me the Review Portal.
Do not prepare a new run or write anything to GitHub.
```

The agent should run the supervised services and return a `review` Portal link. Open it and confirm that the page starts with Livewire PR #10572 and walks from the smallest submitted fix through the security counterexamples to a recommendation.

The checked-in companion does not need to be rebuilt. The three application services may say that no current run is prepared; that is expected for this review-only example.

## Reconstruct a new Livewire PR

Start a new thread in the same Amp Project and provide one PR URL:

```text
Reconstruct this Livewire PR:
https://github.com/livewire/livewire/pull/NUMBER

Keep the production reconstruction blind until it is committed. Use a focused
failing test as the reproduction when that is the clearest proof. When the
review package is ready, start the Portals and give me the Review Portal.
Do not write to GitHub unless I explicitly ask.
```

The project skill guides the agent through the review method. A complete run should:

1. Pin the exact merge base and submitted PR head.
2. Establish a focused reproduction or clearly identify what remains unverified.
3. Build the smallest functioning solution from the base before revealing the submitted production implementation.
4. Add later functioning levels only when a concrete constraint requires them.
5. Compare the submitted PR with the reconstruction and attack material disagreements with focused counterexamples.
6. Produce a concise Review Portal with the recommendation, explanatory diffs, full-file expansion, GitHub source links, and supporting evidence.

A failing test is a valid reproduction. The agent should add screenshots, recordings, snapshots, or interactive Before/Submitted PR/Reconstruction Portals only when they improve understanding.

## Use the review

The Review Portal is the first-pass explanation. It should tell you:

- what the user or framework experiences;
- what the submitted PR changes;
- what the independent reconstruction found;
- why each functioning level succeeds or fails;
- what evidence supports the recommendation;
- what remains uncertain or unjustified.

Open the code sections for the curated Pierre diffs. Each changed file can switch between the focused change and the full file while retaining diff highlighting. Public source files link to the exact GitHub revision.

The recommendation is not a final decision. Continue the conversation in the Amp thread to challenge the reasoning, request another test, revise the reconstruction, or inspect a Portal directly.

## Take GitHub action only when you mean to

Reconstruction and review do not modify the Livewire PR. Ask for one explicit action after you accept the exact target and message, for example:

```text
Draft a concise review comment for the PR author. Do not post it.
```

```text
Post the comment we just approved to the reviewed PR head.
```

```text
Apply the accepted reconstruction to the contributor branch if maintainer edits are allowed.
```

```text
Merge the reviewed PR head.
```

Drafting does not authorize posting. Reviewing does not authorize updating or merging. The agent should confirm that the PR head still matches the reviewed revision before performing a write.

## Current prototype boundaries

- Invocation is manual. There is no automatic webhook, PR label, or slash-command trigger yet.
- PR #10572 is the polished checked-in deconstruction example.
- PR #10610 has the first purpose-built interactive three-environment playground fixture.
- Other Livewire PRs can be ingested, tested, reconstructed, and explained. The agent may need to author a PR-specific reproduction, but a missing interactive playground fixture does not block a test-backed review.
- Some reviews will be test-backed without an interactive application Portal. That is a complete result when the test proves the behavior clearly.
- GitHub comments, branch changes, approvals, and merges happen only after an explicit request.

## No-Project fallback

An Amp Project is the recommended path because it prepares and snapshots the environment. To test from a **No Project** Orb instead, clone and prepare the repository manually:

```bash
gh repo clone jkudish/livewire-pr-reconstruction
cd livewire-pr-reconstruction
./.agents/setup
amp orb services ensure
```

Open the `review` URL printed by the last command. These commands are intended for an Amp Orb, not a macOS local checkout.

## If setup or a Portal fails

- Ask the agent to inspect `/home/user/.cache/amp/logs/setup.log` when the project cannot prepare its Orb.
- Run `amp orb services ensure` again to repair a missing declared service.
- Inspect a service with `amp orb service status <name>` and `amp orb service logs <name>`.
- Use only the Portal URL printed by Amp. A raw `localhost` URL is not reachable outside the Orb.

The repository declares all four services in `.amp/services.yaml`; do not start them with background shell processes.
