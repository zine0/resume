import { invoke } from '@tauri-apps/api/core'
import { markdownToRichContent } from '@/lib/markdown'
import type {
  AiPatchOperation,
  AiPatchTargetKind,
  AiPolishTextResult,
  AiResumePatch,
  AiRewriteForJdResult,
  JDAnalysisResult,
  PolishMode,
} from '@/types/ai'
import type { ModuleContentRow, ResumeData } from '@/types/resume'

const RESUME_TITLE_TARGET_ID = '__resume_title__'
const JD_SUGGESTION_MODULE_TITLE = 'JD 定制建议'

function cloneResumeData(data: ResumeData): ResumeData {
  return typeof structuredClone === 'function'
    ? structuredClone(data)
    : (JSON.parse(JSON.stringify(data)) as ResumeData)
}

function buildPatchedTitle(title: string, patch: AiResumePatch): string {
  const titleOperation = patch.operations.find(
    (operation) =>
      operation.targetKind === 'resumeTitle' && operation.targetId === RESUME_TITLE_TARGET_ID,
  )

  return titleOperation?.text?.trim() || title
}

function applyOperationToResume(next: ResumeData, operation: AiPatchOperation): boolean {
  if (operation.targetKind === 'resumeTitle') {
    if (!operation.text?.trim()) return false
    next.title = operation.text.trim()
    return true
  }

  if (operation.targetKind === 'personalInfo') {
    const item = next.personalInfoSection.personalInfo.find(
      (candidate) => candidate.id === operation.targetId,
    )
    if (!item || !operation.text?.trim()) return false
    item.value.content = operation.text.trim()
    return true
  }

  if (operation.targetKind === 'jobIntention') {
    const item = next.jobIntentionSection?.items.find(
      (candidate) => candidate.id === operation.targetId,
    )
    if (!item || !operation.text?.trim()) return false
    item.value = operation.text.trim()
    if (operation.contentKind === 'salary' && operation.salaryRange) {
      item.salaryRange = operation.salaryRange
    }
    return true
  }

  if (operation.targetKind === 'moduleElement') {
    for (const module of next.modules) {
      for (const row of module.rows) {
        const element = row.elements.find((candidate) => candidate.id === operation.targetId)
        if (!element || !operation.text?.trim()) continue
        element.content = markdownToRichContent(operation.text)
        return true
      }
    }
    return false
  }

  if (operation.targetKind === 'moduleTags') {
    for (const module of next.modules) {
      for (const row of module.rows) {
        if (row.id !== operation.targetId) continue
        const tags = operation.tags?.map((tag) => tag.trim()).filter(Boolean)
        if (!tags?.length) return false
        row.tags = tags
        row.type = 'tags'
        return true
      }
    }
    return false
  }

  return false
}

function nextSyntheticId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildSuggestionRow(operation: AiPatchOperation, index: number): ModuleContentRow {
  const text =
    operation.contentKind === 'tags' ? (operation.tags || []).join('、') : operation.text || ''

  return {
    id: nextSyntheticId(`jd-suggestion-row-${index}`),
    type: 'rich',
    columns: 1,
    order: index,
    elements: [
      {
        id: nextSyntheticId(`jd-suggestion-element-${index}`),
        columnIndex: 0,
        content: markdownToRichContent(text),
      },
    ],
  }
}

export interface ApplyAiPatchResult {
  data: ResumeData
  appliedCount: number
  unmatchedCount: number
}

export function applyAiPatchToResumeData(
  resumeData: ResumeData,
  patch: AiResumePatch,
  options?: {
    fallbackModuleTitle?: string
    titleOverride?: string
    keepCreatedAt?: boolean
  },
): ApplyAiPatchResult {
  const next = cloneResumeData(resumeData)
  const now = new Date().toISOString()
  const createdAt = next.createdAt
  next.title = options?.titleOverride?.trim() || buildPatchedTitle(next.title, patch)
  next.createdAt = options?.keepCreatedAt ? createdAt : now
  next.updatedAt = now

  let appliedCount = 0
  const unmatched: AiPatchOperation[] = []

  for (const operation of patch.operations) {
    if (applyOperationToResume(next, operation)) {
      appliedCount += 1
    } else if (operation.targetKind !== 'resumeTitle') {
      unmatched.push(operation)
    }
  }

  if (unmatched.length > 0 && options?.fallbackModuleTitle) {
    const existingModule = next.modules.find(
      (module) => module.title === options.fallbackModuleTitle,
    )
    const newRows = unmatched.map(buildSuggestionRow)

    if (existingModule) {
      existingModule.rows = [
        ...existingModule.rows,
        ...newRows.map((row, index) => ({
          ...row,
          order: existingModule.rows.length + index,
        })),
      ]
    } else {
      next.modules = [
        ...next.modules,
        {
          id: nextSyntheticId('jd-suggestion-module'),
          title: options.fallbackModuleTitle,
          order: next.modules.length,
          rows: newRows,
        },
      ]
    }
  }

  return {
    data: next,
    appliedCount,
    unmatchedCount: unmatched.length,
  }
}

function mapInvokeError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(String(error || fallback))
}

export async function aiPolishText(text: string, mode: PolishMode): Promise<AiPolishTextResult> {
  try {
    return await invoke<AiPolishTextResult>('ai_polish_text', { text, mode })
  } catch (error) {
    throw mapInvokeError(error, 'AI 处理失败')
  }
}

export async function aiOptimizeResume(data: ResumeData): Promise<AiResumePatch> {
  try {
    return await invoke<AiResumePatch>('ai_optimize_resume', { data })
  } catch (error) {
    throw mapInvokeError(error, '简历优化失败')
  }
}

export async function aiAnalyzeJD(data: ResumeData, jd: string): Promise<JDAnalysisResult> {
  try {
    return await invoke<JDAnalysisResult>('ai_analyze_jd', { data, jd })
  } catch (error) {
    throw mapInvokeError(error, 'JD 分析失败')
  }
}

export async function aiRewriteForJD(
  data: ResumeData,
  jd: string,
  targetKind: AiPatchTargetKind,
  targetId: string,
  suggestion: string,
): Promise<AiRewriteForJdResult> {
  try {
    return await invoke<AiRewriteForJdResult>('ai_rewrite_for_jd', {
      data,
      jd,
      targetKind,
      targetId,
      suggestion,
    })
  } catch (error) {
    throw mapInvokeError(error, 'JD 定向改写失败')
  }
}

export async function aiTestConnection(): Promise<void> {
  try {
    await invoke<void>('ai_test_connection')
  } catch (error) {
    throw mapInvokeError(error, 'AI 连接测试失败')
  }
}

export { JD_SUGGESTION_MODULE_TITLE }
