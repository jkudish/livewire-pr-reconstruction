import { useEffect, useMemo, useState } from 'react'
import { parsePatchFiles, type CodeViewItem } from '@pierre/diffs'
import { CodeView } from '@pierre/diffs/react'
import { CodeBracketIcon, DocumentTextIcon } from '@heroicons/react/16/solid'
import {
  parseRunManifest,
  type Artifact,
  type DeconstructionLevel,
  type DiffEntry,
  type EnvironmentKind,
  type Evidence,
  type EvidenceStatus,
  type RecommendationOption,
  type RunManifest,
} from './types'

const statusStyles: Record<EvidenceStatus, string> = {
  failed: 'bg-red-50 text-red-700 ring-red-200',
  passed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blocked: 'bg-amber-50 text-amber-800 ring-amber-200',
  skipped: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

const levelStatusStyles: Record<DeconstructionLevel['status'], string> = {
  working: 'bg-blue-50 text-blue-700 ring-blue-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  superseded: 'bg-amber-50 text-amber-800 ring-amber-200',
}

const recommendationStatus: Record<RecommendationOption['status'], { label: string; style: string }> = {
  not_recommended: { label: 'Not recommended', style: 'bg-red-50 text-red-700 ring-red-200' },
  disproportionate: { label: 'Disproportionate', style: 'bg-amber-50 text-amber-800 ring-amber-200' },
  recommended: { label: 'Recommended', style: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
}

const button = 'focus-ring rounded-md px-3 py-2.5 text-base/7 font-semibold ring-1 ring-zinc-300 hover:bg-zinc-100 sm:py-2 sm:text-sm/6'
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const environmentLabel = (environment: EnvironmentKind) => environment === 'original' ? 'Submitted PR' : cap(environment)

function SectionHeading({ id, title, description }: { id: string; title: string; description?: string }) {
  return <div className="max-w-[70ch]">
    <h2 id={id} className="text-balance text-2xl font-semibold tracking-tight">{title}</h2>
    {description && <p className="mt-2 text-pretty text-base/7 text-zinc-600">{description}</p>}
  </div>
}

function Header({ run }: { run: RunManifest }) {
  if (run.deconstruction) {
    return <header className="border-b border-zinc-950/10 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-7 sm:py-14">
        <a className="focus-ring rounded text-base/7 font-semibold text-blue-700 hover:underline sm:text-sm/6" href={run.target.url} target="_blank" rel="noreferrer">Livewire PR #{run.pr.number} ↗</a>
        <a className="focus-ring mt-2 block max-w-5xl rounded" href={run.target.url} target="_blank" rel="noreferrer">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{run.pr.title}</h1>
        </a>
        <div className="mt-8 max-w-5xl border-l-4 border-red-500 pl-5">
          <p className="text-base/7 font-semibold text-red-700 sm:text-sm/6">What the user experiences</p>
          <p className="mt-1 text-pretty text-base/7 text-zinc-700">{run.summary.problem}</p>
        </div>
        <div className="mt-8 max-w-5xl border-t border-zinc-950/10 pt-6">
          <p className="text-base/7 font-semibold text-blue-700 sm:text-sm/6">What the submitted change proves, and what it doesn’t</p>
          <p className="mt-2 max-w-[75ch] text-pretty text-base/7 text-zinc-600">{run.deconstruction.intro}</p>
        </div>
      </div>
    </header>
  }

  return <header className="border-b border-zinc-950/10 bg-white">
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-7 sm:py-14">
      <a className="focus-ring rounded text-base/7 font-semibold text-blue-700 hover:underline sm:text-sm/6" href={run.target.url} target="_blank" rel="noreferrer">Livewire PR #{run.pr.number} ↗</a>
      <a className="focus-ring mt-2 max-w-5xl rounded" href={run.target.url} target="_blank" rel="noreferrer"><h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{run.pr.title}</h1></a>
      <div className="mt-9 grid overflow-hidden rounded-xl border border-zinc-950/10 lg:grid-cols-2">
        <div className="p-5 sm:p-6"><p className="text-base/7 font-semibold text-red-700 sm:text-sm/6">What’s broken</p><p className="mt-2 text-pretty text-base/7 text-zinc-700">{run.summary.problem}</p></div>
        <div className="border-t border-zinc-950/10 p-5 sm:p-6 lg:border-l lg:border-t-0"><p className="text-base/7 font-semibold text-blue-700 sm:text-sm/6">How the submitted PR fixes it</p><p className="mt-2 text-pretty text-base/7 text-zinc-700">{run.summary.submitted_fix}</p></div>
        <div className="border-t border-emerald-600/20 bg-emerald-50 p-5 sm:p-6 lg:col-span-2"><p className="text-base/7 font-semibold text-emerald-800 sm:text-sm/6">What the reconstruction found</p><p className="mt-2 text-pretty text-base/7 font-medium text-emerald-950">{run.summary.outcome}</p></div>
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
  return <div>
    <div className="flex items-center justify-between gap-3"><p className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6">{artifact.label}</p><a className="focus-ring rounded text-base/7 font-medium text-blue-700 hover:underline sm:text-sm/6" href={artifact.url} target="_blank" rel="noreferrer">Open ↗</a></div>
    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-sm/6 text-zinc-100">{content}</pre>
  </div>
}

function EvidenceMatrix({ run }: { run: RunManifest }) {
  if (!run.evidence.length) return null
  return <section aria-labelledby="evidence-title" className="flex flex-col gap-5">
    <SectionHeading id="evidence-title" title="The proof" description="The same focused reproduction is evaluated before the change, against the submitted PR, and against the reconstruction." />
    <div className="grid gap-4 lg:grid-cols-3">
      {run.evidence.map((item) => {
        const environment = run.environments.find((candidate) => candidate.id === item.environment)
        const images = item.artifacts?.filter((artifact) => artifact.type === 'image' || artifact.type === 'snapshot') ?? []
        const videos = item.artifacts?.filter((artifact) => artifact.type === 'video') ?? []
        const logs = item.artifacts?.filter((artifact) => artifact.type === 'log') ?? []
        return <article key={item.environment} className="flex min-w-0 flex-col rounded-xl border border-zinc-950/10 p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{environmentLabel(item.environment)}</h3><span className={`rounded-full px-2.5 py-1 text-base/7 font-semibold ring-1 sm:text-sm/6 ${statusStyles[item.status]}`}>{evidenceStatus(item)}</span></div>
          <p className="mt-4 text-pretty text-base/7 text-zinc-600">{item.explanation}</p>
          {environment?.portal_url && <a className="focus-ring mt-4 w-fit rounded text-base/7 font-semibold text-blue-700 hover:underline sm:text-sm/6" href={environment.portal_url} target="_blank" rel="noreferrer">Open live reproduction ↗</a>}
          {(item.output || images.length > 0 || videos.length > 0 || logs.length > 0) && <details className="mt-5 border-t border-zinc-950/10 pt-4">
            <summary className="focus-ring cursor-pointer rounded text-base/7 font-semibold text-zinc-700 sm:text-sm/6">View screenshot and test output</summary>
            <div className="mt-4 flex flex-col gap-5">
              {item.output && <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-sm/6 text-zinc-100">{item.output}</pre>}
              {images.map((artifact) => <figure key={artifact.url}><img className="w-full rounded-lg ring-1 ring-zinc-950/10" src={artifact.url} alt={artifact.label} /><figcaption className="mt-2 text-base/7 text-zinc-600 sm:text-sm/6">{artifact.label}</figcaption></figure>)}
              {videos.map((artifact) => <figure key={artifact.url}><video className="w-full rounded-lg ring-1 ring-zinc-950/10" src={artifact.url} controls /><figcaption className="mt-2 text-base/7 text-zinc-600 sm:text-sm/6">{artifact.label}</figcaption></figure>)}
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
  if (!run.environments.length) return null
  return <section id="try-it" aria-labelledby="environment-title" className="scroll-mt-6 flex flex-col gap-5">
    <SectionHeading id="environment-title" title="Try the bug and the fix" description="Use the same small playground in each state. The direct Portal link is available as an escape hatch." />
    {!!run.summary.reproduction_steps.length && <ol className="grid gap-3 sm:grid-cols-3">{run.summary.reproduction_steps.map((step, index) => <li key={step} className="flex gap-3 rounded-xl border border-zinc-950/10 p-4"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-base/7 font-semibold text-white sm:text-sm/6">{index + 1}</span><span className="text-base/7 text-zinc-700">{step}</span></li>)}</ol>}
    <div className="overflow-hidden rounded-xl border border-zinc-950/10">
      <div className="flex flex-col gap-3 border-b border-zinc-950/10 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1" role="tablist" aria-label="Review environments">{run.environments.map((item) => <button key={item.id} id={`environment-tab-${item.id}`} role="tab" aria-controls="environment-viewer" aria-selected={active === item.id} onClick={() => setActive(item.id)} className={`focus-ring min-h-10 rounded-md px-3 py-2 text-base/7 font-semibold sm:text-sm/6 ${active === item.id ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-950/10' : 'text-zinc-600 hover:text-zinc-950'}`}>{environmentLabel(item.id)}</button>)}</div>
        {environment?.portal_url && <a className="focus-ring w-fit rounded px-1 text-base/7 font-semibold text-blue-700 hover:underline sm:text-sm/6" href={environment.portal_url} target="_blank" rel="noreferrer">Open {environmentLabel(environment.id)} Portal ↗</a>}
      </div>
      {environment?.portal_url ? <div key={environment.id} id="environment-viewer" role="tabpanel" aria-labelledby={`environment-tab-${environment.id}`}><iframe title={`${environmentLabel(environment.id)} environment`} src={`/environment/${environment.id}/`} className="h-[44rem] w-full border-0 bg-white" /></div> : <div id="environment-viewer" role="tabpanel" className="grid h-96 place-items-center bg-zinc-100 p-6 text-center text-base/7 text-zinc-500">The interactive playground has not been prepared for this environment.</div>}
    </div>
  </section>
}

function DiffEntryViewer({ diff, compact = false }: { diff: DiffEntry; compact?: boolean }) {
  const [view, setView] = useState<'diff' | 'file'>('diff')
  const focusedItems = useMemo<CodeViewItem[]>(() => parsePatchFiles(diff.patch, diff.id, true).flatMap((patch, patchIndex) => patch.files.map((fileDiff, fileIndex) => ({ id: `${diff.id}-${patchIndex}-${fileIndex}`, type: 'diff' as const, fileDiff }))), [diff])
  const fullFileItems = useMemo<CodeViewItem[]>(() => {
    if (diff.full_patch) {
      return parsePatchFiles(diff.full_patch, `${diff.id}-full-file`, true).flatMap((patch, patchIndex) => patch.files.map((fileDiff, fileIndex) => ({ id: `${diff.id}-full-file-${patchIndex}-${fileIndex}`, type: 'diff' as const, fileDiff })))
    }
    return diff.full_file ? [{
      id: `${diff.id}-full-file`,
      type: 'file' as const,
      file: {
        name: diff.full_file.path,
        contents: diff.full_file.contents,
        cacheKey: `${diff.full_file.revision}:${diff.full_file.path}`,
      },
    }] : []
  }, [diff])
  const items = view === 'file' && fullFileItems.length ? fullFileItems : focusedItems
  const filename = diff.path ?? diff.full_file?.path ?? diff.label
  const displayName = filename.split('/').pop() ?? filename
  const codeViewClass = view === 'file'
    ? 'min-h-[36rem]'
    : `overflow-y-auto overscroll-contain ${compact ? 'max-h-[50rem]' : 'max-h-[72rem]'}`

  return <div className="overflow-hidden rounded-lg border border-zinc-950/10 bg-white">
    <div className="flex flex-col gap-3 border-b border-zinc-950/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {diff.full_file?.github_url
          ? <a className="focus-ring block rounded font-mono text-base/7 font-semibold text-blue-700 hover:underline sm:text-sm/6" href={diff.full_file.github_url} title={filename} target="_blank" rel="noreferrer">{displayName} ↗</a>
          : <><p className="font-mono text-base/7 font-semibold text-zinc-950 sm:text-sm/6" title={filename}>{displayName}</p><p className="text-base/7 text-zinc-500 sm:text-sm/6">Local reconstruction · no GitHub revision</p></>}
        {!!diff.source_links?.length && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{diff.source_links.map((link) => <a key={`${link.label}-${link.url}`} className="focus-ring rounded text-base/7 text-zinc-600 hover:text-blue-700 hover:underline sm:text-sm/6" href={link.url} target="_blank" rel="noreferrer">{link.label} on GitHub ↗</a>)}</div>}
      </div>
      {diff.full_file && <button className="focus-ring relative inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white py-2 pr-3 pl-2 text-base/7 font-semibold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 sm:text-sm/6" type="button" onClick={() => setView((current) => current === 'diff' ? 'file' : 'diff')}>
        <span className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2" aria-hidden="true" />
        {view === 'diff'
          ? <DocumentTextIcon className="h-lh size-4 shrink-0 fill-zinc-500" aria-hidden="true" />
          : <CodeBracketIcon className="h-lh size-4 shrink-0 fill-zinc-500" aria-hidden="true" />}
        {view === 'diff' ? 'View full file' : 'View focused diff'}
      </button>}
    </div>
    {items.length
      ? <CodeView items={items} options={{ diffStyle: 'unified', theme: 'github-light', disableFileHeader: true, disableLineNumbers: false, overflow: 'wrap', unsafeCSS: '@media (max-width: 640px) { [data-overflow="wrap"] [data-line] { word-break: normal; overflow-wrap: anywhere; } }' }} className={codeViewClass} />
      : <p className="p-6 text-base/7 text-zinc-500">No file content is available for this comparison.</p>}
  </div>
}

function DiffViewer({ diffs, compact = false }: { diffs: DiffEntry[]; compact?: boolean }) {
  if (!diffs.length) return <p className="p-6 text-base/7 text-zinc-500">No files in this comparison.</p>
  return <div className="flex flex-col gap-4">{diffs.map((diff) => <DiffEntryViewer key={diff.id} diff={diff} compact={compact} />)}</div>
}

function Level({ level, index, run }: { level: DeconstructionLevel; index: number; run: RunManifest }) {
  const diffs = level.diff_ids.map((id) => run.diffs.find((diff) => diff.id === id)).filter((diff): diff is DiffEntry => Boolean(diff))
  const diffContent = diffs.length ? <DiffViewer diffs={diffs} compact={index === 0} /> : null

  return <article className="relative border-l border-zinc-950/15 pb-12 pl-7 last:border-transparent last:pb-0 sm:pl-10">
    <span className="absolute -left-3 top-0 grid size-6 place-items-center rounded-full bg-zinc-950 text-base/7 font-semibold text-white ring-4 ring-white sm:text-sm/6">{index + 1}</span>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-mono text-base/7 font-medium uppercase tracking-wide text-zinc-500 sm:text-sm/6">{level.label}</p>
        <h3 className="mt-1 text-balance text-2xl font-semibold tracking-tight text-zinc-950">{level.title}</h3>
      </div>
      <span className={`w-fit rounded-full px-2.5 py-1 text-base/7 font-semibold ring-1 sm:text-sm/6 ${levelStatusStyles[level.status]}`}>{cap(level.status)}</span>
    </div>
    <p className="mt-4 max-w-[75ch] text-pretty text-base/7 text-zinc-700">{level.summary}</p>
    <dl className="mt-5 grid gap-4 border-y border-zinc-950/10 py-5 lg:grid-cols-2">
      <div><dt className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6">Question this level exposes</dt><dd className="mt-1 text-pretty text-base/7 text-zinc-600">{level.question}</dd></div>
      <div><dt className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6">Decisive proof</dt><dd className="mt-1 text-pretty text-base/7 text-zinc-600">{level.proof}</dd></div>
    </dl>
    {level.output && <pre className="mt-5 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-sm/6 text-zinc-100">{level.output}</pre>}
    {diffContent && <div className="mt-5">{diffContent}</div>}
  </article>
}

function DeconstructionReview({ run }: { run: RunManifest }) {
  const deconstruction = run.deconstruction!
  const recommendation = deconstruction.recommendation

  return <>
    <section aria-labelledby="tour-title" className="flex flex-col gap-8">
      <SectionHeading id="tour-title" title="Start with the smallest solution" />
      <div>{deconstruction.levels.map((level, index) => <Level key={level.id} level={level} index={index} run={run} />)}</div>
    </section>

    <section aria-labelledby="recommendation-title" className="rounded-xl bg-zinc-950 p-6 text-white sm:p-8">
      <p className="font-mono text-base/7 font-medium uppercase tracking-wide text-zinc-400 sm:text-sm/6">Review recommendation</p>
      <h2 id="recommendation-title" className="mt-2 text-balance text-3xl font-semibold tracking-tight">{recommendation.title}</h2>
      <p className="mt-4 max-w-[75ch] text-pretty text-base/7 text-zinc-300">{recommendation.explanation}</p>
      <div className="mt-7 border-t border-white/15 pt-6">
        <h3 className="text-lg font-semibold">Why we recommend this</h3>
        <ul className="mt-4 grid gap-4 lg:grid-cols-3">{recommendation.reasons.map((reason) => <li key={reason} className="border-l border-white/20 pl-4 text-pretty text-base/7 text-zinc-300">{reason}</li>)}</ul>
      </div>
    </section>

    <section aria-labelledby="options-title" className="flex flex-col gap-5">
      <SectionHeading id="options-title" title="Options considered" />
      <div className="divide-y divide-zinc-950/10 border-y border-zinc-950/10">{recommendation.options.map((option) => <article key={option.title} className="grid gap-3 py-5 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(0,1.3fr)] lg:gap-8">
        <div className="flex flex-col items-start gap-2"><h3 className="text-lg font-semibold text-zinc-950">{option.title}</h3><span className={`rounded-full px-2.5 py-1 text-base/7 font-semibold ring-1 sm:text-sm/6 ${recommendationStatus[option.status].style}`}>{recommendationStatus[option.status].label}</span></div>
        <p className="text-pretty text-base/7 text-zinc-600">{option.explanation}</p>
      </article>)}</div>
    </section>

    <section aria-labelledby="application-paths-title" className="flex flex-col gap-5">
      <SectionHeading id="application-paths-title" title="What applications can do instead" />
      <div className="grid border-y border-zinc-950/10 lg:grid-cols-2">{recommendation.application_paths.map((path, index) => <article key={path.title} className={`py-5 lg:px-6 ${index > 0 ? 'border-t border-zinc-950/10 lg:border-l lg:border-t-0 lg:pr-0' : 'lg:pl-0'}`}>
        <p className="text-base/7 font-semibold text-blue-700 sm:text-sm/6">{path.label}</p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-950">{path.title}</h3>
        <p className="mt-2 text-pretty text-base/7 text-zinc-600">{path.explanation}</p>
      </article>)}</div>
    </section>
  </>
}

function Reconstruction({ run }: { run: RunManifest }) {
  const [mode, setMode] = useState<DiffEntry['kind']>('original')
  const visible = run.diffs.filter((diff) => diff.kind === mode)
  const production = visible.filter((diff) => diff.category === 'production')
  const evidence = visible.filter((diff) => diff.category === 'evidence')
  const labels: Record<DiffEntry['kind'], string> = { original: 'Submitted PR', reconstruction: 'Reconstruction', step: 'Causal steps', comparison: 'Submitted vs reconstructed' }
  return <section aria-labelledby="story-title" className="flex flex-col gap-6">
    <SectionHeading id="story-title" title="How the fix works" description="The production change is grouped by responsibility so the reviewer can see what each piece fixes." />
    <div className="grid gap-4 lg:grid-cols-2">{run.stories.map((item, index) => <article key={item.id} className="overflow-hidden rounded-xl border border-zinc-950/10">
      <div className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-900 text-base/7 font-semibold text-white sm:text-sm/6">{index + 1}</span><h3 className="text-lg font-semibold">{item.title}</h3></div>
        <dl className="mt-5 space-y-4"><div><dt className="text-base/7 font-semibold text-red-700 sm:text-sm/6">Fixes</dt><dd className="mt-1 text-base/7 text-zinc-600">{item.what_was_wrong}</dd></div><div><dt className="text-base/7 font-semibold text-blue-700 sm:text-sm/6">The change</dt><dd className="mt-1 text-base/7 text-zinc-600">{item.what_changed}</dd></div><div><dt className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6">Why it’s necessary</dt><dd className="mt-1 text-base/7 text-zinc-600">{item.why_necessary}</dd></div></dl>
      </div>
      <div className="border-t border-emerald-600/20 bg-emerald-50 px-5 py-4 text-base/7 text-emerald-950 sm:px-6"><span className="font-semibold">Proof:</span> {item.proof}</div>
    </article>)}</div>
    <div className="rounded-xl bg-blue-50 p-5 ring-1 ring-blue-600/20 sm:p-6"><p className="text-base/7 font-semibold text-blue-800 sm:text-sm/6">Submitted PR vs reconstruction</p><p className="mt-2 max-w-[85ch] text-pretty text-base/7 text-blue-950">{run.summary.comparison}</p></div>
    <details className="group overflow-hidden rounded-xl border border-zinc-950/10">
      <summary className="focus-ring cursor-pointer list-none p-5 sm:p-6"><span className="flex items-start gap-3"><svg aria-hidden="true" viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 fill-current group-open:rotate-90"><path d="M5 3.5 11 8l-6 4.5z" /></svg><span><span className="text-base/7 font-semibold text-zinc-950">Code, when you need it</span><span className="mt-1 text-base/7 text-zinc-600 sm:text-sm/6">Open the curated Pierre diffs. Every file can expand to its complete contents.</span></span></span></summary>
      <div className="border-t border-zinc-950/10 bg-zinc-50 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Diff mode">{(['original', 'reconstruction', 'step', 'comparison'] as const).map((item) => <button key={item} onClick={() => setMode(item)} className={`${button} ${mode === item ? 'bg-zinc-900 text-white ring-zinc-900 hover:bg-zinc-800' : 'bg-white text-zinc-700'}`}>{labels[item]}</button>)}</div>
        <div className="mt-4"><p className="mb-3 text-base/7 font-semibold text-zinc-950 sm:text-sm/6">Production code · {labels[mode]}</p>{production.length ? <DiffViewer diffs={production} /> : <p className="rounded-lg bg-white p-6 text-base/7 text-zinc-600 ring-1 ring-zinc-950/10">This view contains no production-code changes.</p>}</div>
        {!!evidence.length && <details className="mt-4 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-950/10"><summary className="focus-ring cursor-pointer p-4 text-base/7 font-semibold sm:text-sm/6">Test and evidence changes · {evidence.length} patch{evidence.length === 1 ? '' : 'es'}</summary><div className="border-t border-zinc-950/10 p-4"><DiffViewer diffs={evidence} /></div></details>}
      </div>
    </details>
  </section>
}

function ReviewNotes({ run }: { run: RunManifest }) {
  const notes = [['Uncertainties', run.uncertainties], ['Unjustified production changes', run.unjustified_production_changes]].filter(([, values]) => values.length)
  if (!notes.length) return null
  return <section aria-labelledby="review-notes-title" className="flex flex-col gap-4"><SectionHeading id="review-notes-title" title="Open review notes" description="These are the remaining gaps that prevent a clean conclusion." /><div className="grid gap-4 lg:grid-cols-2">{notes.map(([title, values]) => <div key={title as string} className="rounded-xl border border-amber-600/20 p-5"><h3 className="text-lg font-semibold">{title as string}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-base/7 text-zinc-600">{(values as string[]).map((value) => <li key={value}>{value}</li>)}</ul></div>)}</div></section>
}

export default function App() {
  const [run, setRun] = useState<RunManifest | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('run')
    const manifestUrl = requested?.startsWith('/') ? requested : '/run.json?fixture=1'
    fetch(manifestUrl)
      .then((response) => { if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`); return response.json() })
      .then((data) => setRun(parseRunManifest(data)))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unknown load error.'))
  }, [])
  if (error) return <main className="isolate grid min-h-dvh place-items-center p-6"><div className="max-w-lg rounded-lg border border-red-600/20 p-6"><p className="text-base/7 font-semibold text-red-700 sm:text-sm/6">Manifest unavailable</p><h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight">Review data could not be loaded</h1><p className="mt-3 text-pretty text-base/7 text-zinc-600">Check that the requested run manifest exists and matches schema version 1. {error}</p><button className={`${button} mt-5 bg-zinc-900 text-white ring-zinc-900`} onClick={() => location.reload()}>Try again</button></div></main>
  if (!run) return <main className="isolate grid min-h-dvh place-items-center p-6"><p role="status" className="text-base/7 text-zinc-600">Loading reconstruction evidence…</p></main>
  return <div className="isolate min-h-dvh bg-white antialiased"><Header run={run} /><main aria-label="PR reconstruction review" className="mx-auto flex max-w-7xl flex-col gap-16 px-5 py-12 sm:px-7 sm:py-16">{run.deconstruction ? <DeconstructionReview run={run} /> : <><EvidenceMatrix run={run} /><Environments run={run} /><Reconstruction run={run} /></>}<ReviewNotes run={run} /></main></div>
}
