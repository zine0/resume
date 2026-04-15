import type { ApplicationEntry } from '@/types/application'
import type { StoredResume } from '@/types/resume'

export interface ResumeInspectorMetadataItem {
  label: string
  value: string
}

export interface ResumeCompareSummary {
  leftLabel: string
  leftTitle: string
  leftVariantLabel: string
  rightLabel: string
  rightTitle: string
  rightVariantLabel: string
  newerSide: 'left' | 'right' | 'same'
  moduleDelta: number
  sharedModuleTitles: string[]
  leftOnlyModuleTitles: string[]
  rightOnlyModuleTitles: string[]
  personalInfoDelta: number
  avatarChanged: boolean
  jobIntentionChanged: boolean
}

export type ResumeInspectorState =
  | { mode: 'detail'; resumeId: string }
  | {
      mode: 'compare'
      familyId: string
      leftId: string
      rightId: string
      leftLabel: string
      rightLabel: string
    }

export interface UserCenterInspectorDetailBodyProps {
  applicationsAvailable: boolean
  resume: StoredResume | null
  metadata: ResumeInspectorMetadataItem[] | null
  applications: ApplicationEntry[]
  sourceApplication: ApplicationEntry | null
  latestApplication: ApplicationEntry | null
  formatInspectorTime: (value: string) => string
  formatApplicationDate: (value?: string, options?: Intl.DateTimeFormatOptions) => string
  formatApplicationStatusSummary: (applications: ApplicationEntry[]) => string
  getFamilyId: (item: StoredResume) => string
}

export interface UserCenterInspectorCompareBodyProps {
  inspector: Extract<ResumeInspectorState, { mode: 'compare' }>
  resumes: { left: StoredResume | null; right: StoredResume | null } | null
  summary: ResumeCompareSummary | null
  getFamilyId: (item: StoredResume) => string
  getPersonalInfoCount: (resume: StoredResume) => number
}
