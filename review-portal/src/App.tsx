import { useEffect, useMemo, useState } from 'react'
import { parsePatchFiles, type CodeViewItem } from '@pierre/diffs'
import { CodeView } from '@pierre/diffs/react'
import { parseRunManifest, type Artifact, type DiffEntry, type EnvironmentKind, type Evidence, type EvidenceStatus, type RunManifest } from './types'

const statusStyles: Record<EvidenceStatus, string> = {
  failed: 'bg-red-50 text-red-700 ring-red-200', passed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blocked: 'bg-amber-50 text-amber-800 ring-amber-200', skipped: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const button = 'focus-ring rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60'
const environmentLabel = (environment: EnvironmentKind) => environment === 'original' ? 'Submitted PR' : cap(environment)

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return <div className="max-w-3xl"><h2 id={id} className="text-xl/7 font-semibold tracking-tight sm:text-2xl/8">{title}</h2><p className="mt-1 text-base/7 text-zinc-600">{description}</p></div>
}

function Header({ run }: { run: RunManifest }) {
  return <header className="border-b border-zinc-200 bg-white">
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-7 sm:py-14">
      <a className="focus-ring rounded text-sm/6 font-semibold text-blue-700 hover:underline" href={run.target.url} target="_blank" rel="noreferrer">Livewire PR #{run.pr.number} ↗</a>
      <a className="focus-ring mt-2 block max-w-5xl rounded" href={run.target.url} target="_blank" rel="noreferrer">
        <h1 className="text-3xl/10 font-semibold tracking-tight text-zinc-950 sm:text-4xl/11">{run.pr.title}</h1>
      </a>
      <div className="mt-9 grid overflow-hidden rounded-xl bg-zinc-200 ring-1 ring-zinc-200 lg:grid-cols-2">
        <div className="bg-white p-5 sm:p-6">
          <p className="text-sm/6 font-semibold text-red-700">What’s broken</p>
          <p className="mt-2 text-base/7 text-zinc-700">{run.summary.problem}</p>
        </div>
        <div className="border-t border-zinc-200 bg-white p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="text-sm/6 font-semibold text-blue-700">How the submitted PR fixes it</p>
          <p className="mt-2 text-base/7 text-zinc-700">{run.summary.submitted_fix}</p>
        </div>
        <div className="border-t border-emerald-200 bg-emerald-50 p-5 sm:p-6 lg:col-span-2">
          <p className="text-sm/6 font-semibold text-emerald-800">What the reconstruction found</p>
          <p className="mt-2 text-base/7 font-medium text-emerald-950">{run.summary.outcome}</p>
        </div>
      </div>
    </div>
  </header>
}

function evidenceStatus(item: Evidence) {
  if (item.status === 'blocked') return 'Reproduction blocked'
  if (item.status === 'skipped') return 'Not yet tested'
  if (item.environment === 'before') return item.status === 'failed' ? 'Issue reproduced' : 'Issue not reproduced'
  return item.status === 'passed' ? 'Fix holds' : 'Regression remains'
}

function LogArtifact({ artifact }: { artifact: Artifact }) {
  const [content, setContent] = useState('Loading full test log…')
  useEffect(() => {
    fetch(artifact.url)
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text() })
      .then(setContent)
      .catch(() => setContent('The full test log could not be loaded. Open it in a new tab instead.'))
  }, [artifact.url])
  return <div><div className="flex items-center justify-between gap-3"><p className="text-sm/6 font-semibold text-zinc-950">{artifact.label}</p><a className="focus-ring rounded text-sm/6 font-medium text-blue-700 hover:underline" href={artifact.url} target="_blank" rel="noreferrer">Open ↗</a></div><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-xs/5 text-zinc-100">{content}</pre></div>
}

function EvidenceMatrix({ run }: { run: RunManifest }) {
  return <section aria-labelledby="evidence-title" className="flex flex-col gap-5">
    <SectionHeading id="evidence-title" title="The proof" description="The same focused reproduction is evaluated before the change, against the submitted PR, and against the independent reconstruction." />
    <div className="grid gap-4 lg:grid-cols-3">
      {run.evidence.map((item) => {
        const environment = run.environments.find((candidate) => candidate.id === item.environment)
        const images = item.artifacts?.filter((artifact) => artifact.type === 'image' || artifact.type === 'snapshot') ?? []
        const videos = item.artifacts?.filter((artifact) => artifact.type === 'video') ?? []
        const logs = item.artifacts?.filter((artifact) => artifact.type === 'log') ?? []
        return <article key={item.environment} className="flex min-w-0 flex-col rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg/6 font-semibold">{environmentLabel(item.environment)}</h3><span className={`rounded-full px-2.5 py-1 text-xs/5 font-semibold ring-1 ${statusStyles[item.status]}`}>{evidenceStatus(item)}</span></div>
          <p className="mt-4 text-base/7 text-zinc-600">{item.explanation}</p>
          {environment?.portal_url && <a className="focus-ring mt-4 w-fit rounded text-sm/6 font-semibold text-blue-700 hover:underline" href={environment.portal_url} target="_blank" rel="noreferrer">Open live reproduction ↗</a>}
          {(item.output || images.length > 0 || videos.length > 0 || logs.length > 0) && <details className="mt-5 border-t border-zinc-200 pt-4">
            <summary className="focus-ring cursor-pointer rounded text-sm/6 font-semibold text-zinc-700">View screenshot and test output</summary>
            <div className="mt-4 flex flex-col gap-5">
              {item.output && <div><p className="text-sm/6 font-semibold text-zinc-950">Focused browser test result</p><pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-xs/5 text-zinc-100">{item.output}</pre></div>}
              {images.map((artifact) => <figure key={artifact.url}><img className="w-full rounded-lg ring-1 ring-zinc-200" src={artifact.url} alt={artifact.label} /><figcaption className="mt-2 text-sm/6 text-zinc-600">{artifact.label}</figcaption></figure>)}
              {videos.map((artifact) => <figure key={artifact.url}><video className="w-full rounded-lg ring-1 ring-zinc-200" src={artifact.url} controls /><figcaption className="mt-2 text-sm/6 text-zinc-600">{artifact.label}</figcaption></figure>)}
              {logs.map((artifact) => <LogArtifact key={artifact.url} artifact={artifact} />)}
            </div>
          </details>}
        </article>
      })}
    </div>
  </section>
}

function Environments({ run }: { run: RunManifest }) {
  const [active, setActive] = useState(run.environments[0]?.id)
  const environment = run.environments.find((candidate) => candidate.id === active)
  return <section id="try-it" aria-labelledby="environment-title" className="scroll-mt-6 flex flex-col gap-5">
    <SectionHeading id="environment-title" title="Try the bug and the fix" description="Use the same small playground in each state. The viewer stays on this page; the direct Portal link is available as an escape hatch." />
    {!!run.summary.reproduction_steps.length && <ol className="grid gap-3 sm:grid-cols-3">{run.summary.reproduction_steps.map((step, index) => <li key={step} className="flex gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{index + 1}</span><span className="text-sm/6 text-zinc-700">{step}</span></li>)}</ol>}
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1" role="tablist" aria-label="Review environments">{run.environments.map((item) => <button key={item.id} id={`environment-tab-${item.id}`} role="tab" aria-controls="environment-viewer" aria-selected={active === item.id} onClick={() => setActive(item.id)} className={`focus-ring min-h-10 rounded-md px-3 py-2 text-sm font-semibold ${active === item.id ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-600 hover:text-zinc-950'}`}>{environmentLabel(item.id)}</button>)}</div>
        {environment?.portal_url && <a className="focus-ring w-fit rounded px-1 text-sm/6 font-semibold text-blue-700 hover:underline" href={environment.portal_url} target="_blank" rel="noreferrer">Open {environmentLabel(environment.id)} Portal ↗</a>}
      </div>
      {environment?.portal_url ? <div key={environment.id} id="environment-viewer" role="tabpanel" aria-labelledby={`environment-tab-${environment.id}`}><iframe title={`${environmentLabel(environment.id)} environment`} src={`/environment/${environment.id}/`} className="h-[44rem] w-full border-0 bg-white" /></div> : <div id="environment-viewer" role="tabpanel" className="grid h-96 place-items-center bg-zinc-100 p-6 text-center text-base/7 text-zinc-500">The interactive playground has not been prepared for this environment.</div>}
    </div>
  </section>
}

function DiffViewer({ diffs }: { diffs: DiffEntry[] }) {
  const items = useMemo<CodeViewItem[]>(() => diffs.flatMap((diff) => parsePatchFiles(diff.patch, diff.id, true).flatMap((patch, patchIndex) => patch.files.map((fileDiff, fileIndex) => ({ id: `${diff.id}-${patchIndex}-${fileIndex}`, type: 'diff' as const, fileDiff })))), [diffs])
  if (!items.length) return <p className="p-6 text-base/7 text-zinc-500 sm:text-sm/6">No files in this comparison.</p>
  return <CodeView items={items} options={{ diffStyle: 'unified', theme: 'github-light', disableLineNumbers: false }} className="h-[34rem] sm:h-[40rem]" />
}

function Reconstruction({ run }: { run: RunManifest }) {
  const [mode, setMode] = useState<DiffEntry['kind']>('original')
  const visible = run.diffs.filter((diff) => diff.kind === mode)
  const production = visible.filter((diff) => diff.category === 'production')
  const evidence = visible.filter((diff) => diff.category === 'evidence')
  const labels: Record<DiffEntry['kind'], string> = { original: 'Submitted PR', reconstruction: 'Reconstruction', step: 'Causal steps', comparison: 'Submitted vs reconstructed' }
  return <section aria-labelledby="story-title" className="flex flex-col gap-6">
    <SectionHeading id="story-title" title="How the fix works" description="The production change has two responsibilities. Separating them makes it clear which failure each piece fixes." />
    <div className="grid gap-4 lg:grid-cols-2">{run.stories.map((item, index) => <article key={item.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
      <div className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-900 text-sm font-semibold text-white">{index + 1}</span><h3 className="text-lg/6 font-semibold">{item.title}</h3></div>
        <dl className="mt-5 space-y-4 text-sm/6"><div><dt className="font-semibold text-red-700">Fixes</dt><dd className="mt-1 text-zinc-600">{item.what_was_wrong}</dd></div><div><dt className="font-semibold text-blue-700">The change</dt><dd className="mt-1 text-zinc-600">{item.what_changed}</dd></div><div><dt className="font-semibold text-zinc-950">Why it’s necessary</dt><dd className="mt-1 text-zinc-600">{item.why_necessary}</dd></div></dl>
      </div>
      <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-4 text-sm/6 text-emerald-950 sm:px-6"><span className="font-semibold">Proof:</span> {item.proof}</div>
    </article>)}</div>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 sm:p-6"><p className="text-sm/6 font-semibold text-blue-800">Submitted PR vs reconstruction</p><p className="mt-2 max-w-4xl text-base/7 text-blue-950">{run.summary.comparison}</p></div>
    <details className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
      <summary className="focus-ring cursor-pointer p-5 sm:p-6"><span className="block text-base/7 font-semibold text-zinc-950">Code, when you need it</span><span className="mt-1 block text-sm/6 text-zinc-600">Open the curated Pierre diffs. Test changes stay separate from production code.</span></summary>
      <div className="border-t border-zinc-200 bg-zinc-50 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Diff mode">{(['original', 'reconstruction', 'step', 'comparison'] as const).map((item) => <button key={item} onClick={() => setMode(item)} className={`${button} ${mode === item ? 'bg-zinc-900 text-white ring-zinc-900 hover:bg-zinc-800' : 'bg-white text-zinc-700'}`}>{labels[item]}</button>)}</div>
        <div className="mt-4 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200"><div className="border-b border-zinc-200 p-4"><p className="text-sm/6 font-semibold">Production code · {labels[mode]}</p></div>{production.length ? <DiffViewer diffs={production} /> : <p className="p-6 text-base/7 text-zinc-600">{mode === 'comparison' ? 'The submitted PR and reconstruction have identical production code, so there is no production diff to render.' : 'This view contains no production-code changes.'}</p>}</div>
        {!!evidence.length && <details className="mt-4 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200"><summary className="focus-ring cursor-pointer p-4 text-sm/6 font-semibold">Test and evidence changes · {evidence.length} patch{evidence.length === 1 ? '' : 'es'}</summary><div className="border-t border-zinc-200"><DiffViewer diffs={evidence} /></div></details>}
      </div>
    </details>
  </section>
}

function ReviewNotes({ run }: { run: RunManifest }) {
  const notes = [['Uncertainties', run.uncertainties], ['Unjustified production changes', run.unjustified_production_changes]].filter(([, values]) => values.length)
  if (!notes.length) return null
  return <section aria-labelledby="review-notes-title" className="flex flex-col gap-4"><SectionHeading id="review-notes-title" title="Open review notes" description="These are the remaining gaps that prevent a clean conclusion." /><div className="grid gap-4 lg:grid-cols-2">{notes.map(([title, values]) => <div key={title as string} className="rounded-xl bg-white p-5 ring-1 ring-amber-200"><h3 className="text-lg/6 font-semibold">{title as string}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-base/7 text-zinc-600">{(values as string[]).map((value) => <li key={value}>{value}</li>)}</ul></div>)}</div></section>
}

export default function App() {
  const [run, setRun] = useState<RunManifest | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { fetch('/run.json').then((response) => { if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`); return response.json() }).then((data) => setRun(parseRunManifest(data))).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unknown load error.')) }, [])
  if (error) return <main className="isolate grid min-h-dvh place-items-center p-6"><div className="max-w-lg rounded-lg bg-white p-6 ring-1 ring-red-200"><p className="text-sm/6 font-semibold text-red-700">Manifest unavailable</p><h1 className="mt-2 text-2xl/8 font-semibold">Review data could not be loaded</h1><p className="mt-3 text-base/7 text-zinc-600">Check that <code>/run.json</code> exists and matches schema version 1. {error}</p><button className={`${button} mt-5 bg-zinc-900 text-white ring-zinc-900`} onClick={() => location.reload()}>Try again</button></div></main>
  if (!run) return <main className="isolate grid min-h-dvh place-items-center p-6"><p role="status" className="text-base/7 text-zinc-600">Loading reconstruction evidence…</p></main>
  return <div className="isolate min-h-dvh"><Header run={run} /><main aria-label="PR reconstruction review" className="mx-auto flex max-w-7xl flex-col gap-14 px-5 py-12 sm:px-7 sm:py-16"><EvidenceMatrix run={run} /><Environments run={run} /><Reconstruction run={run} /><ReviewNotes run={run} /></main></div>
}
