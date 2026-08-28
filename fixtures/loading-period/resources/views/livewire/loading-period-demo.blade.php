<div
    class="demo"
    x-data="{ fastFinished: false, slowFinished: false }"
    x-on:fast-finished.window="fastFinished = true"
    x-on:slow-finished.window="slowFinished = true"
>
    <div class="actions">
        <button type="button" wire:click.async="fastAction" dusk="fast">Start fast request</button>
        <button type="button" wire:click.async="slowAction" dusk="slow">Start slow request</button>
    </div>

    <button type="button" class="target existing" wire:loading.attr="disabled" wire:loading.class="existing loading-added" dusk="target">
        Shared loading target
    </button>

    <dl>
        <div><dt>Fast request</dt><dd x-text="fastFinished ? 'Finished' : 'Waiting'">Waiting</dd></div>
        <div><dt>Slow request</dt><dd x-text="slowFinished ? 'Finished' : 'Waiting'">Waiting</dd></div>
        <div><dt>Target state</dt><dd wire:loading>Loading</dd><dd wire:loading.remove>Idle</dd></div>
    </dl>

    <p>Start both requests quickly. The target should stay disabled until the slow request finishes, then return to its original class and attribute state.</p>
</div>
