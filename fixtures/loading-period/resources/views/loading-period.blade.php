<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Livewire loading period reproduction</title>
    @livewireStyles
    <style>
        :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #18181b; background: #fafafa; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        main { width: min(48rem, calc(100% - 2rem)); margin: 0 auto; padding: 3rem 0; }
        header { margin-bottom: 2rem; }
        h1 { margin: .35rem 0; font-size: clamp(2rem, 5vw, 3.25rem); letter-spacing: -.04em; }
        p { color: #52525b; line-height: 1.65; }
        code { font-size: .9em; }
        [x-cloak] { display: none !important; }
        .demo { display: grid; gap: 1.25rem; padding-top: 1.5rem; border-top: 1px solid rgba(24, 24, 27, .12); }
        .actions { display: flex; flex-wrap: wrap; gap: .75rem; }
        button { min-height: 2.5rem; padding: .6rem .9rem; border: 1px solid rgba(24, 24, 27, .16); border-radius: .5rem; background: white; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
        button:focus-visible { outline: 2px solid #0284c7; outline-offset: 2px; }
        button:disabled { cursor: wait; opacity: .55; }
        .run { color: white; border-color: #18181b; background: #18181b; }
        .target { justify-self: start; border-color: #0e7490; }
        .loading-added { background: #ecfeff; }
        dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; overflow: hidden; border: 1px solid rgba(24, 24, 27, .1); border-radius: .5rem; background: rgba(24, 24, 27, .1); }
        dl div { padding: 1rem; background: white; }
        dt { color: #71717a; font-size: .875rem; }
        dd { margin: .25rem 0 0; font-weight: 600; }
        .checkpoint { padding: 1rem; border: 1px solid; border-radius: .5rem; }
        .checkpoint[data-result="bug"] { color: #7f1d1d; border-color: #fecaca; background: #fef2f2; }
        .checkpoint[data-result="fixed"] { color: #065f46; border-color: #a7f3d0; background: #ecfdf5; }
        .checkpoint p { margin: .25rem 0 0; color: inherit; }
        .checkpoint-grid { margin-top: 1rem; grid-template-columns: repeat(2, 1fr); }
        .checkpoint-grid dt { color: inherit; opacity: .75; }
        .checkpoint-grid dd { font-size: .95rem; }
        @media (max-width: 38rem) { dl { grid-template-columns: 1fr; } main { padding-top: 2rem; } }
    </style>
</head>
<body>
<main>
    <header>
        <p>Before · Submitted PR · Reconstruction</p>
        <h1>One loading period, even when requests overlap.</h1>
        <p>This small playground reproduces the behavior under review without adding demonstration code to Livewire itself.</p>
    </header>
    <livewire:loading-period-demo />
</main>
@livewireScripts
<script>
    const prefix = @js(request()->header('X-Reconstruction-Prefix', ''));
    const livewireScript = document.querySelector('script[data-update-uri]')

    if (prefix && livewireScript) {
        livewireScript.dataset.updateUri = livewireScript.dataset.updateUri.replace(prefix + prefix, prefix)
    }
</script>
</body>
</html>
