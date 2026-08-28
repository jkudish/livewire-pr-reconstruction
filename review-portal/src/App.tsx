import { useEffect, useMemo, useState } from 'react'
import { parsePatchFiles, type CodeViewItem } from '@pierre/diffs'
import { CodeView } from '@pierre/diffs/react'
import { parseRunManifest, type DiffEntry, type EvidenceStatus, type RunManifest } from './types'

const statusStyles: Record<EvidenceStatus, string> = {
  failed: 'bg-red-50 text-red-700 ring-red-200', passed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blocked: 'bg-amber-50 text-amber-800 ring-amber-200', skipped: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const sha = (value: string) => value.slice(0, 8)
const button = 'focus-ring rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60'

function Header({ run }: { run: RunManifest }) {
  return <header className="border-b border-zinc-200 bg-white">
    <div className="mx-auto flex max-w-[100rem] flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-base/7 font-semibold text-blue-700 sm:text-sm/6">Livewire · PR #{run.pr.number}</p>
        <h1 className="max-w-4xl text-2xl/8 font-semibold tracking-tight sm:text-3xl/9">{run.pr.title}</h1>
        <p className="text-base/7 text-zinc-600 sm:text-sm/6">Evidence-first reconstruction review · source: {run.pr.source} · {run.pr.confidence} confidence</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-base/7 sm:text-sm/6">
        {Object.entries(run.revisions).map(([key, value]) => <div key={key} className="rounded-md bg-zinc-100 px-2.5 py-1 font-mono tabular-nums text-zinc-700"><span className="text-zinc-500">{key}</span> {sha(value)}</div>)}
        <span className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${run.review_status === 'verified' ? statusStyles.passed : statusStyles.blocked}`}>{cap(run.review_status)}</span>
      </div>
    </div>
  </header>
}

function EvidenceMatrix({ run }: { run: RunManifest }) {
  return <section aria-labelledby="evidence-title" className="flex flex-col gap-4">
    <div><h2 id="evidence-title" className="text-xl/7 font-semibold">Evidence matrix</h2><p className="text-base/7 text-zinc-600 sm:text-sm/6">The same decisive behavior, evaluated at each revision.</p></div>
    <div className="grid gap-px overflow-hidden rounded-lg bg-zinc-200 ring-1 ring-zinc-200 lg:grid-cols-3">
      {run.evidence.map((item) => <article key={item.environment} className="flex flex-col gap-4 bg-white p-5">
        <div className="flex items-center justify-between gap-3"><h3 className="text-lg/6 font-semibold sm:text-base/6">{cap(item.environment)}</h3><span className={`rounded-full px-2.5 py-1 text-sm font-semibold ring-1 sm:text-xs ${statusStyles[item.status]}`}>{cap(item.status)}</span></div>
        <div className="flex flex-col gap-1"><p className="text-base/7 font-semibold sm:text-sm/6">{item.assertion}</p><p className="text-base/7 text-zinc-600 sm:text-sm/6">{item.explanation}</p></div>
        {item.output && <details className="border-t border-zinc-200 pt-3"><summary className="focus-ring cursor-pointer rounded text-base/7 font-medium text-zinc-700 sm:text-sm/6">Inspect output</summary><pre className="mt-3 max-h-56 overflow-auto rounded-md bg-zinc-950 p-3 text-xs/5 text-zinc-100">{item.output}</pre></details>}
        {!!item.artifacts?.length && <ul role="list" className="flex flex-wrap gap-2">{item.artifacts.map((artifact) => <li key={artifact.url}><a className="focus-ring rounded text-base/7 font-medium text-blue-700 underline underline-offset-4 sm:text-sm/6" href={artifact.url} target="_blank" rel="noreferrer">{artifact.label} ↗</a></li>)}</ul>}
      </article>)}
    </div>
  </section>
}

function Environments({ run }: { run: RunManifest }) {
  const [active, setActive] = useState(run.environments[0]?.id)
  return <section aria-labelledby="environment-title" className="flex flex-col gap-4">
    <div><h2 id="environment-title" className="text-xl/7 font-semibold">Environment viewers</h2><p className="text-base/7 text-zinc-600 sm:text-sm/6">Inspect rendered behavior without losing revision identity.</p></div>
    <div className="flex gap-1 rounded-lg bg-zinc-200 p-1 lg:hidden" role="tablist" aria-label="Review environments">{run.environments.map((env) => <button key={env.id} role="tab" aria-selected={active === env.id} onClick={() => setActive(env.id)} className={`focus-ring flex-1 rounded-md px-2 py-2.5 text-sm font-semibold ${active === env.id ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'}`}>{env.label}</button>)}</div>
    <div className="grid gap-4 lg:grid-cols-3">{run.environments.map((env) => <article key={env.id} role="tabpanel" className={`${active === env.id ? 'flex' : 'hidden'} min-w-0 flex-col overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200 lg:flex`}>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4"><div><h3 className="text-lg/6 font-semibold sm:text-base/6">{env.label}</h3><p className="text-base/7 text-zinc-500 sm:text-sm/6">{sha(env.sha)} · {env.description}</p></div>{env.portal_url ? <a className="focus-ring whitespace-nowrap rounded text-sm font-semibold text-blue-700" href={env.portal_url} target="_blank" rel="noreferrer">Open ↗</a> : <span className="text-sm text-zinc-500">No portal</span>}</div>
      {env.portal_url ? <iframe title={`${env.label} environment`} src={env.portal_url} className="h-[48rem] w-full border-0 bg-white" sandbox="allow-forms allow-same-origin allow-scripts" /> : <div className="grid h-[48rem] place-items-center bg-zinc-100 p-6 text-center text-base/7 text-zinc-500 sm:text-sm/6">Viewer URL was not captured for this environment.</div>}
    </article>)}</div>
  </section>
}

function DiffViewer({ diffs }: { diffs: DiffEntry[] }) {
  const items = useMemo<CodeViewItem[]>(() => diffs.flatMap((diff) => parsePatchFiles(diff.patch, diff.id, true).flatMap((patch, patchIndex) => patch.files.map((fileDiff, fileIndex) => ({ id: `${diff.id}-${patchIndex}-${fileIndex}`, type: 'diff' as const, fileDiff })))), [diffs])
  if (!items.length) return <p className="p-6 text-base/7 text-zinc-500 sm:text-sm/6">No files in this comparison.</p>
  return <CodeView items={items} options={{ diffStyle: 'unified', theme: 'github-light', disableLineNumbers: false }} className="max-h-[44rem]" />
}

function Reconstruction({ run }: { run: RunManifest }) {
  const [story, setStory] = useState<string | null>(null)
  const [mode, setMode] = useState<DiffEntry['kind']>('reconstruction')
  const selected = run.stories.find((item) => item.id === story)
  const visible = selected ? run.diffs.filter((diff) => selected.diff_ids.includes(diff.id)) : run.diffs.filter((diff) => diff.kind === mode)
  const production = visible.filter((diff) => diff.category === 'production')
  const evidence = visible.filter((diff) => diff.category === 'evidence')
  return <section aria-labelledby="story-title" className="flex flex-col gap-5">
    <div><h2 id="story-title" className="text-xl/7 font-semibold">Reconstruction story</h2><p className="text-base/7 text-zinc-600 sm:text-sm/6">Select a rationale to narrow the comparison to only its referenced changes.</p></div>
    <div className="grid gap-3 lg:grid-cols-2">{run.stories.map((item) => <button key={item.id} aria-pressed={story === item.id} onClick={() => setStory(story === item.id ? null : item.id)} className={`focus-ring rounded-lg p-5 text-left ring-1 ${story === item.id ? 'bg-blue-50 ring-blue-400' : 'bg-white ring-zinc-200 hover:bg-zinc-50'}`}><h3 className="text-lg/6 font-semibold sm:text-base/6">{item.title}</h3><dl className="mt-4 grid gap-3 text-base/7 sm:grid-cols-2 sm:text-sm/6">{[['What was wrong', item.what_was_wrong], ['What changed', item.what_changed], ['Why necessary', item.why_necessary], ['Proof', item.proof]].map(([term, value]) => <div key={term}><dt className="font-semibold text-zinc-950">{term}</dt><dd className="text-zinc-600">{value}</dd></div>)}</dl></button>)}</div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Diff mode">{(['original', 'reconstruction', 'step', 'comparison'] as const).map((item) => <button key={item} disabled={!!selected} onClick={() => setMode(item)} className={`${button} ${!selected && mode === item ? 'bg-zinc-900 text-white ring-zinc-900 hover:bg-zinc-800' : 'bg-white text-zinc-700'}`}>{item === 'comparison' ? 'Original vs reconstruction' : cap(item)}</button>)}{selected && <button onClick={() => setStory(null)} className={`${button} bg-white text-zinc-700`}>Clear story filter</button>}</div>
    <div className="overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200"><div className="border-b border-zinc-200 p-4"><p className="text-base/7 font-semibold sm:text-sm/6">Production comparison · {production.length} patch{production.length === 1 ? '' : 'es'}</p></div><DiffViewer diffs={production} /></div>
    {!!evidence.length && <details className="overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200"><summary className="focus-ring cursor-pointer p-4 text-base/7 font-semibold sm:text-sm/6">Evidence and test changes · {evidence.length} patch{evidence.length === 1 ? '' : 'es'}</summary><div className="border-t border-zinc-200"><DiffViewer diffs={evidence} /></div></details>}
  </section>
}

function ReviewNotes({ run }: { run: RunManifest }) {
  return <section className="grid gap-px overflow-hidden rounded-lg bg-zinc-200 ring-1 ring-zinc-200 lg:grid-cols-2">{[['Uncertainties', run.uncertainties], ['Unjustified production changes', run.unjustified_production_changes]].map(([title, values]) => <div key={title as string} className="bg-white p-5"><h2 className="text-lg/6 font-semibold">{title as string}</h2>{(values as string[]).length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-base/7 text-zinc-600 sm:text-sm/6">{(values as string[]).map((value) => <li key={value}>{value}</li>)}</ul> : <p className="mt-3 text-base/7 text-zinc-600 sm:text-sm/6">None identified.</p>}</div>)}</section>
}

function ActionBar({ status }: { status: RunManifest['review_status'] }) {
  return <div className="border-t border-zinc-200 bg-white p-3"><div className="mx-auto flex max-w-[100rem] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm/6 text-zinc-500">Preview controls · not yet connected</p><div className="flex flex-wrap gap-2">{['Update PR', 'Comment', 'Approve', 'Request changes', 'Merge'].map((label) => <button key={label} title="Not yet connected" onClick={() => window.alert(`${label} is not yet connected.`)} className={`${button} ${label === (status === 'verified' ? 'Approve' : 'Request changes') ? 'bg-blue-700 text-white ring-blue-700 hover:bg-blue-800' : 'bg-white text-zinc-700'}`}>{label}</button>)}</div></div></div>
}

export default function App() {
  const [run, setRun] = useState<RunManifest | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { fetch('/run.json').then((response) => { if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`); return response.json() }).then((data) => setRun(parseRunManifest(data))).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unknown load error.')) }, [])
  if (error) return <main className="isolate grid min-h-dvh place-items-center p-6"><div className="max-w-lg rounded-lg bg-white p-6 ring-1 ring-red-200"><p className="text-sm/6 font-semibold text-red-700">Manifest unavailable</p><h1 className="mt-2 text-2xl/8 font-semibold">Review data could not be loaded</h1><p className="mt-3 text-base/7 text-zinc-600">Check that <code>/run.json</code> exists and matches schema version 1. {error}</p><button className={`${button} mt-5 bg-zinc-900 text-white ring-zinc-900`} onClick={() => location.reload()}>Try again</button></div></main>
  if (!run) return <main className="isolate grid min-h-dvh place-items-center p-6"><p role="status" className="text-base/7 text-zinc-600">Loading reconstruction evidence…</p></main>
  return <div className="isolate min-h-dvh"><Header run={run} /><main className="mx-auto flex max-w-[100rem] flex-col gap-12 p-5 pb-16 sm:p-7 sm:pb-20"><EvidenceMatrix run={run} /><Environments run={run} /><Reconstruction run={run} /><ReviewNotes run={run} /></main><ActionBar status={run.review_status} /></div>
}
