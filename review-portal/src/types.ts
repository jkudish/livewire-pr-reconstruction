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
  full_patch?: string
  path?: string
  source_links?: { label: string; url: string }[]
  full_file?: {
    path: string
    revision: string
    contents: string
    github_url?: string
  }
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

export interface DeconstructionLevel {
  id: string
  label: string
  title: string
  status: 'working' | 'rejected' | 'superseded'
  summary: string
  question: string
  proof: string
  output?: string
  diff_ids: string[]
}

export interface RecommendationOption {
  title: string
  status: 'not_recommended' | 'disproportionate' | 'recommended'
  explanation: string
}

export interface ApplicationPath {
  label: string
  title: string
  explanation: string
}

export interface Deconstruction {
  intro: string
  levels: DeconstructionLevel[]
  recommendation: {
    title: string
    explanation: string
    reasons: string[]
    options: RecommendationOption[]
    application_paths: ApplicationPath[]
  }
}

export interface RunManifest {
  schema_version: 1
  target: { repository: string; pull_request: number; url: string }
  pr: { number: number; title: string; source?: string; confidence?: 'high' | 'medium' | 'low' }
  summary: {
    problem: string
    submitted_fix: string
    outcome: string
    comparison: string
    reproduction_steps: string[]
  }
  revisions: { base: string; head: string; reconstruction: string }
  review_status: 'verified' | 'candidate'
  evidence: Evidence[]
  environments: ReviewEnvironment[]
  stories: Story[]
  diffs: DiffEntry[]
  deconstruction?: Deconstruction
  uncertainties: string[]
  unjustified_production_changes: string[]
}

export function parseRunManifest(value: unknown): RunManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifest must be a JSON object.')
  const run = value as Partial<RunManifest>
  if (run.schema_version !== 1) throw new Error('Unsupported or missing schema_version (expected 1).')
  if (!run.target?.url || !run.pr?.title || !run.revisions?.base || !run.revisions.head || !run.revisions.reconstruction) {
    throw new Error('PR identity and revision fields are required.')
  }
  if (!run.summary?.problem || !run.summary.submitted_fix || !run.summary.outcome || !run.summary.comparison || !Array.isArray(run.summary.reproduction_steps)) {
    throw new Error('Reviewer-facing problem, fix, outcome, comparison, and reproduction steps are required.')
  }
  for (const key of ['evidence', 'environments', 'stories', 'diffs', 'uncertainties', 'unjustified_production_changes'] as const) {
    if (!Array.isArray(run[key])) throw new Error(`"${key}" must be an array.`)
  }
  if (!run.diffs!.every((diff) => diff.id && diff.label && typeof diff.patch === 'string')) {
    throw new Error('Every diff requires id, label, and patch.')
  }
  if (run.deconstruction && (!Array.isArray(run.deconstruction.levels) || !run.deconstruction.recommendation?.title || !Array.isArray(run.deconstruction.recommendation.reasons) || !Array.isArray(run.deconstruction.recommendation.options) || !Array.isArray(run.deconstruction.recommendation.application_paths))) {
    throw new Error('Deconstruction reviews require levels and an explained recommendation.')
  }
  return run as RunManifest
}
