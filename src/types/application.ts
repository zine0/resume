export type ApplicationStatus = 'wishlist' | 'applied' | 'interview' | 'offer' | 'rejected'

export type ApplicationReminderStatus = 'pending' | 'completed' | 'snoozed'

export type ApplicationReviewStatus = 'active' | 'waiting' | 'blocked'

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
  followUpDate?: string
  reminderStatus?: ApplicationReminderStatus
  interviewStage?: string
  interviewRound?: string
  reviewStatus?: ApplicationReviewStatus
  blockedReason?: string
  result?: string
  notes?: string
}

export interface ApplicationEntry extends ApplicationInput {
  id: string
  createdAt: string
  updatedAt: string
}
