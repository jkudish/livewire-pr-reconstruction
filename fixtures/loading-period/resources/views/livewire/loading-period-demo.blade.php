<div
    class="demo"
    x-data="{
        fastFinished: false,
        slowFinished: false,
        running: false,
        checkpoint: null,
        run() {
            this.fastFinished = false
            this.slowFinished = false
            this.checkpoint = null
            this.running = true

            this.$nextTick(() => {
                this.$refs.fast.click()
                this.$refs.slow.click()
            })
        },
        captureCheckpoint() {
            this.fastFinished = true

            setTimeout(() => {
                let target = this.$refs.target
                let disabled = target.disabled
                let keptExistingClass = target.classList.contains('existing')

                this.checkpoint = {
                    correct: disabled && keptExistingClass,
                    observed: `${disabled ? 'disabled' : 'enabled'}; existing class ${keptExistingClass ? 'retained' : 'removed'}`,
                }
            }, 50)
        },
        finish() {
            this.slowFinished = true
            this.running = false
        },
    }"
    x-on:fast-finished.window="captureCheckpoint()"
    x-on:slow-finished.window="finish()"
>
    <div class="actions">
        <button type="button" class="run" x-on:click="run()" x-bind:disabled="running" dusk="run">
            <span x-text="running ? 'Running reproduction…' : checkpoint ? 'Run reproduction again' : 'Run reproduction'">Run reproduction</span>
        </button>
        <button type="button" x-ref="fast" wire:click.async="fastAction" dusk="fast" hidden>Start fast request</button>
        <button type="button" x-ref="slow" wire:click.async="slowAction" dusk="slow" hidden>Start slow request</button>
    </div>

    <button type="button" x-ref="target" class="target existing" wire:loading.attr="disabled" wire:loading.class="existing loading-added" dusk="target">
        Shared loading target
    </button>

    <dl>
        <div><dt>Fast request</dt><dd x-text="fastFinished ? 'Finished' : 'Waiting'">Waiting</dd></div>
        <div><dt>Slow request</dt><dd x-text="slowFinished ? 'Finished' : 'Waiting'">Waiting</dd></div>
        <div><dt>Target state</dt><dd wire:loading>Loading</dd><dd wire:loading.remove>Idle</dd></div>
    </dl>

    <section
        class="checkpoint"
        x-cloak
        x-show="checkpoint"
        x-bind:data-result="checkpoint?.correct ? 'fixed' : 'bug'"
        aria-live="polite"
    >
        <p><strong x-text="checkpoint?.correct ? 'Fix holds at the decisive moment' : 'Bug reproduced at the decisive moment'"></strong></p>
        <p>The fast request finished while the slow request was still running. This result remains visible after both requests finish.</p>
        <dl class="checkpoint-grid">
            <div><dt>Expected target</dt><dd>Disabled; existing class retained</dd></div>
            <div><dt>Observed target</dt><dd x-text="checkpoint?.observed"></dd></div>
        </dl>
    </section>

    <p>Before should report the bug in red. Submitted PR and Reconstruction should report the fix in green.</p>
</div>
