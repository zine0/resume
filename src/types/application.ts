export type ApplicationStatus = 'wishlist' | 'applied' | 'interview' | 'offer' | 'rejected'

export interface ApplicationInput {
  status: ApplicationStatus
  company: string
  role: string
  jdText?: string
  resumeId?: string
  resumeTitle?: string
  url?: string
  appliedAt?: string
  source?: string
  contactName?: string
  contactChannel?: string
  lastContactAt?: string
  nextAction?: string
  interviewStage?: string
  interviewRound?: string
  blockedReason?: string
  result?: string
  notes?: string
}

export interface ApplicationEntry extends ApplicationInput {
  id: string
  createdAt: string
  updatedAt: string
}
