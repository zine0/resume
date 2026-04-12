export interface AIConfig {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
}

export type PolishMode = 'polish' | 'expand' | 'shorten' | 'translate_en' | 'translate_zh'

export type AiPatchTargetKind =
  | 'resumeTitle'
  | 'personalInfo'
  | 'jobIntention'
  | 'moduleElement'
  | 'moduleTags'

export type AiPatchContentKind = 'plain' | 'markdown' | 'tags' | 'salary'

export interface SalaryRangeValue {
  min?: number
  max?: number
}

export interface AiPatchOperation {
  targetKind: AiPatchTargetKind
  targetId: string
  contentKind: AiPatchContentKind
  text?: string
  tags?: string[]
  salaryRange?: SalaryRangeValue
}

export interface AiResumePatch {
  operations: AiPatchOperation[]
  warnings: string[]
}

export interface AiPolishTextResult {
  text: string
}

export interface JDAnalysisSuggestion {
  section: string
  field?: string
  originalText: string
  suggestedText: string
  reason: string
  targetKind?: AiPatchTargetKind
  targetId?: string
  contentKind: AiPatchContentKind
  tags?: string[]
  salaryRange?: SalaryRangeValue
}

export interface JDAnalysisResult {
  matchScore: number
  missingKeywords: string[]
  matchedKeywords: string[]
  suggestions: JDAnalysisSuggestion[]
  summary: string
  patch: AiResumePatch
}

export interface AiRewriteForJdResult {
  suggestion?: JDAnalysisSuggestion
  patch: AiResumePatch
}

export const AI_PRESETS: Record<string, { label: string; baseUrl: string; models: string[] }> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  moonshot: {
    label: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
  },
  zhipu: {
    label: '智谱 (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-flash', 'glm-4-air', 'glm-4-plus'],
  },
  custom: {
    label: '自定义',
    baseUrl: '',
    models: [],
  },
}
