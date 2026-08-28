export type EvidenceStatus = 'failed' | 'passed' | 'blocked' | 'skipped'
export type EnvironmentKind = 'before' | 'original' | 'reconstruction'
export type DiffKind = 'original' | 'reconstruction' | 'step' | 'comparison'

export interface Artifact {
  label: string
  url: string
  type: 'image' | 'video' | 'snapshot' | 'log'
}

export interface Evidence {
  environment: EnvironmentKind
  status: EvidenceStatus
  assertion: string
  explanation: string
  output?: string
  artifacts?: Artifact[]
}

export interface ReviewEnvironment {
  id: EnvironmentKind
  label: string
  sha: string
  portal_url?: string
  description: string
}

export interface DiffEntry {
  id: string
  label: string
  kind: DiffKind
  category: 'production' | 'evidence'
  patch: string
}

export interface Story {
  id: string
  title: string
  what_was_wrong: string
  what_changed: string
  why_necessary: string
  proof: string
  diff_ids: string[]
}

export interface RunManifest {
  schema_version: 1
  pr: { number: number; title: string; source: string; confidence: 'high' | 'medium' | 'low' }
  revisions: { base: string; head: string; reconstruction: string }
  review_status: 'verified' | 'candidate'
  evidence: Evidence[]
  environments: ReviewEnvironment[]
  stories: Story[]
  diffs: DiffEntry[]
  uncertainties: string[]
  unjustified_production_changes: string[]
}

export function parseRunManifest(value: unknown): RunManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifest must be a JSON object.')
  const run = value as Partial<RunManifest>
  if (run.schema_version !== 1) throw new Error('Unsupported or missing schema_version (expected 1).')
  if (!run.pr?.title || !run.pr.source || !run.revisions?.base || !run.revisions.head || !run.revisions.reconstruction) {
    throw new Error('PR identity and revision fields are required.')
  }
  for (const key of ['evidence', 'environments', 'stories', 'diffs', 'uncertainties', 'unjustified_production_changes'] as const) {
    if (!Array.isArray(run[key])) throw new Error(`"${key}" must be an array.`)
  }
  if (!run.diffs!.every((diff) => diff.id && diff.label && typeof diff.patch === 'string')) {
    throw new Error('Every diff requires id, label, and patch.')
  }
  return run as RunManifest
}
