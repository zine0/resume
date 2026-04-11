import type { AIConfig, AIMessage, PolishMode, JDAnalysisResult } from "@/types/ai"
import type { JSONContent, PersonalInfoItem, ResumeData } from "@/types/resume"

export interface ResumeOptimizationOutcome {
  resumeData: ResumeData
  warnings: string[]
}

interface ResumeOptimizationSnapshot {
  title: string
  personalInfo: Array<{
    id: string
    label: string
    value: string
  }>
  jobIntention: Array<{
    id: string
    label: string
    value: string
    type: string
  }>
  moduleElements: Array<{
    id: string
    moduleTitle: string
    text: string
  }>
  moduleTags: Array<{
    id: string
    moduleTitle: string
    tags: string[]
  }>
}

interface ResumeOptimizationResult {
  title?: string
  personalInfo?: Array<{
    id: string
    value: string
  }>
  jobIntention?: Array<{
    id: string
    value: string
  }>
  moduleElements?: Array<{
    id: string
    text: string
  }>
  moduleTags?: Array<{
    id: string
    tags: string[]
  }>
}

interface OptimizationValidationSummary {
  missingPersonalInfoCount: number
  missingJobIntentionCount: number
  missingModuleElementCount: number
  missingModuleTagCount: number
  unknownIdCount: number
}

const FACTUAL_PERSONAL_INFO_LABEL_RE = /(邮箱|邮件|mail|e-?mail|手机|电话|tel|电话号|微信|wechat|github|gitlab|博客|blog|主页|网站|链接|link|url|地址|作品集|portfolio|网址)/i

function extractText(content: unknown): string {
  if (!content) return ""
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.map(extractText).join("")
  if (typeof content === "object") {
    const node = content as Record<string, unknown>
    if (node.type === "hardBreak") return "\n"
    if (node.type === "text") return String(node.text || "")
    if (node.content) return extractText(node.content)
  }
  return ""
}

function textToRichContent(text: string): JSONContent {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  return {
    type: "doc",
    content: lines.map((line) => (
      line
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph", content: [] }
    )),
  }
}

function cloneResumeData(data: ResumeData): ResumeData {
  return typeof structuredClone === "function"
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data)) as ResumeData
}

function buildOptimizedTitle(title: string): string {
  return /优化版/.test(title) ? title : `${title} - 优化版`
}

function isProtectedPersonalInfo(item: PersonalInfoItem): boolean {
  return item.value.type === "link" || FACTUAL_PERSONAL_INFO_LABEL_RE.test(item.label)
}

function isSimpleTextContent(content: JSONContent | undefined): boolean {
  if (!content) return false

  if (content.type === "text") {
    return !content.marks?.length
  }

  if (content.type === "hardBreak") {
    return true
  }

  if (!content.content?.length) {
    return content.type === "paragraph" || content.type === "doc"
  }

  return content.content.every((child) => isSimpleTextContent(child))
}

function parseSalaryRange(text: string): { min?: number; max?: number } | null {
  const matches = Array.from(text.matchAll(/\d+/g)).map((match) => Number.parseInt(match[0], 10))
  if (matches.length === 0 || matches.some(Number.isNaN)) {
    return null
  }

  if (matches.length === 1) {
    if (/[起以上上]/.test(text)) return { min: matches[0] }
    if (/[以下内]/.test(text)) return { max: matches[0] }
    return { min: matches[0] }
  }

  return {
    min: Math.min(matches[0], matches[1]),
    max: Math.max(matches[0], matches[1]),
  }
}

function parseJSONResponse<T>(raw: string): T {
  const jsonStr = raw
    .replace(/```json?\n?/g, "")
    .replace(/```/g, "")
    .trim()

  return JSON.parse(jsonStr) as T
}

function buildOptimizationSnapshot(data: ResumeData): ResumeOptimizationSnapshot {
  return {
    title: data.title,
    personalInfo: data.personalInfoSection.personalInfo
      .filter((item) => !isProtectedPersonalInfo(item))
      .map((item) => ({
        id: item.id,
        label: item.label,
        value: item.value.content,
      })),
    jobIntention: data.jobIntentionSection?.enabled
      ? data.jobIntentionSection.items.map((item) => ({
        id: item.id,
        label: item.label,
        value: item.value,
        type: item.type,
      }))
      : [],
    moduleElements: data.modules.flatMap((module) => (
      module.rows.flatMap((row) => {
        if (row.type === "tags") {
          return []
        }

        return row.elements.flatMap((element) => (
          isSimpleTextContent(element.content)
            ? [{
              id: element.id,
              moduleTitle: module.title,
              text: extractText(element.content),
            }]
            : []
        ))
      })
    )),
    moduleTags: data.modules.flatMap((module) => (
      module.rows.flatMap((row) => (
        row.type === "tags" && row.tags?.length
          ? [{ id: row.id, moduleTitle: module.title, tags: row.tags }]
          : []
      ))
    )),
  }
}

function buildIdSet(ids: Iterable<string>): Set<string> {
  return new Set(Array.from(ids).filter(Boolean))
}

function validateOptimizationResult(
  snapshot: ResumeOptimizationSnapshot,
  result: ResumeOptimizationResult,
): OptimizationValidationSummary {
  const expectedPersonalInfoIds = buildIdSet(snapshot.personalInfo.map((item) => item.id))
  const expectedJobIntentionIds = buildIdSet(snapshot.jobIntention.map((item) => item.id))
  const expectedModuleElementIds = buildIdSet(snapshot.moduleElements.map((item) => item.id))
  const expectedModuleTagIds = buildIdSet(snapshot.moduleTags.map((item) => item.id))

  const actualPersonalInfoIds = buildIdSet((result.personalInfo || []).map((item) => item.id))
  const actualJobIntentionIds = buildIdSet((result.jobIntention || []).map((item) => item.id))
  const actualModuleElementIds = buildIdSet((result.moduleElements || []).map((item) => item.id))
  const actualModuleTagIds = buildIdSet((result.moduleTags || []).map((item) => item.id))

  const countMissing = (expected: Set<string>, actual: Set<string>) => (
    Array.from(expected).filter((id) => !actual.has(id)).length
  )

  const countUnknown = (actual: Set<string>, expected: Set<string>) => (
    Array.from(actual).filter((id) => !expected.has(id)).length
  )

  return {
    missingPersonalInfoCount: countMissing(expectedPersonalInfoIds, actualPersonalInfoIds),
    missingJobIntentionCount: countMissing(expectedJobIntentionIds, actualJobIntentionIds),
    missingModuleElementCount: countMissing(expectedModuleElementIds, actualModuleElementIds),
    missingModuleTagCount: countMissing(expectedModuleTagIds, actualModuleTagIds),
    unknownIdCount:
      countUnknown(actualPersonalInfoIds, expectedPersonalInfoIds)
      + countUnknown(actualJobIntentionIds, expectedJobIntentionIds)
      + countUnknown(actualModuleElementIds, expectedModuleElementIds)
      + countUnknown(actualModuleTagIds, expectedModuleTagIds),
  }
}

function buildOptimizationWarnings(
  data: ResumeData,
  snapshot: ResumeOptimizationSnapshot,
  validation: OptimizationValidationSummary,
): string[] {
  const warnings: string[] = []
  const protectedPersonalInfoCount = data.personalInfoSection.personalInfo.filter((item) => isProtectedPersonalInfo(item)).length
  const skippedComplexModuleElementCount = data.modules.flatMap((module) => module.rows)
    .filter((row) => row.type !== "tags")
    .flatMap((row) => row.elements)
    .filter((element) => !isSimpleTextContent(element.content)).length

  if (protectedPersonalInfoCount > 0) {
    warnings.push(`已保留 ${protectedPersonalInfoCount} 项联系方式/链接等事实信息，不参与 AI 改写。`)
  }

  if (skippedComplexModuleElementCount > 0) {
    warnings.push(`已保留 ${skippedComplexModuleElementCount} 处复杂富文本结构，避免破坏原有格式。`)
  }

  const missingTotal = validation.missingPersonalInfoCount
    + validation.missingJobIntentionCount
    + validation.missingModuleElementCount
    + validation.missingModuleTagCount

  if (missingTotal > 0) {
    warnings.push(`AI 未完整返回 ${missingTotal} 项内容，这些部分已保留原文。`)
  }

  if (validation.unknownIdCount > 0) {
    warnings.push(`AI 返回了 ${validation.unknownIdCount} 个无法识别的条目，系统已忽略。`)
  }

  if (
    snapshot.personalInfo.length
    + snapshot.jobIntention.length
    + snapshot.moduleElements.length
    + snapshot.moduleTags.length === 0
  ) {
    warnings.push("当前简历中没有可安全自动优化的文本内容。")
  }

  return warnings
}

function applyOptimizationResult(data: ResumeData, result: ResumeOptimizationResult): ResumeData {
  const next = cloneResumeData(data)
  const now = new Date().toISOString()

  const personalInfoMap = new Map((result.personalInfo || []).map((item) => [item.id, item.value]))
  const jobIntentionMap = new Map((result.jobIntention || []).map((item) => [item.id, item.value]))
  const moduleElementMap = new Map((result.moduleElements || []).map((item) => [item.id, item.text]))
  const moduleTagsMap = new Map((result.moduleTags || []).map((item) => [item.id, item.tags]))

  next.title = buildOptimizedTitle(result.title?.trim() || next.title)
  next.createdAt = now
  next.updatedAt = now

  next.personalInfoSection.personalInfo = next.personalInfoSection.personalInfo.map((item) => {
    if (isProtectedPersonalInfo(item)) return item
    const optimized = personalInfoMap.get(item.id)?.trim()
    if (!optimized) return item
    return {
      ...item,
      value: {
        ...item.value,
        content: optimized,
      },
    }
  })

  if (next.jobIntentionSection?.items?.length) {
    next.jobIntentionSection.items = next.jobIntentionSection.items.map((item) => {
      const optimized = jobIntentionMap.get(item.id)?.trim()
      if (!optimized) return item

      if (item.type === "salary") {
        const parsedRange = parseSalaryRange(optimized)
        return {
          ...item,
          value: optimized,
          salaryRange: parsedRange ?? item.salaryRange,
        }
      }

      return {
        ...item,
        value: optimized,
      }
    })
  }

  next.modules = next.modules.map((module) => ({
    ...module,
    rows: module.rows.map((row) => {
      if (row.type === "tags") {
        const optimizedTags = moduleTagsMap.get(row.id)?.filter(Boolean)
        if (!optimizedTags?.length) return row
        return {
          ...row,
          tags: optimizedTags,
        }
      }

      return {
        ...row,
        elements: row.elements.map((element) => {
          const optimized = moduleElementMap.get(element.id)?.trim()
          if (!optimized) return element
          return {
            ...element,
            content: textToRichContent(optimized),
          }
        }),
      }
    }),
  }))

  return next
}

export class AIService {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  private async chat(
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(
        `AI API 请求失败 (${response.status}): ${body || response.statusText}`
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("AI API 返回了空内容")
    }
    return content
  }

  async polishText(text: string, mode: PolishMode): Promise<string> {
    const prompts: Record<PolishMode, string> = {
      polish: `你是一个专业的简历优化助手。请润色以下简历文本，使其更加专业、简洁、有说服力。

要求：
1. 使用更精准的动词（如"主导"、"推动"、"优化"、"构建"等）
2. 尽量量化成果（如"提升30%"、"服务10万+用户"等），在原文缺少量化数据时可合理推断补充
3. 保持原文的核心含义不变
4. 直接返回润色后的文本，不要添加解释、前缀或后缀

原始文本：`,
      expand: `你是一个专业的简历优化助手。请将以下简历文本扩写，添加更多合理的专业细节和成果描述。

要求：
1. 保持原文的核心含义和结构
2. 添加合理的工作细节（使用的技术、解决的难题、优化的方向）
3. 添加可量化的成果描述
4. 使用专业术语
5. 直接返回扩写后的文本，不要添加解释或前缀

原始文本：`,
      shorten: `你是一个专业的简历优化助手。请精简以下简历文本，去除冗余，保留最核心的信息。

要求：
1. 保留最关键的信息和成果
2. 去除重复和不必要的描述
3. 保持专业性和可读性
4. 直接返回精简后的文本，不要添加解释或前缀

原始文本：`,
      translate_en: `You are a professional resume translator. Translate the following Chinese resume text into professional, natural-sounding English. Use strong action verbs and maintain a professional tone. Return only the translated text without any explanation or prefix.

Original text:`,
      translate_zh: `你是一个专业的简历翻译助手。将以下英文简历翻译为专业、地道的中文简历表达。使用专业的行业术语。直接返回翻译后的文本，不要添加解释或前缀。

Original text:`,
    }

    const messages: AIMessage[] = [
      { role: "user", content: `${prompts[mode]}\n${text}` },
    ]

    return this.chat(messages)
  }

  async optimizeResume(data: ResumeData): Promise<ResumeOptimizationOutcome> {
    const snapshot = buildOptimizationSnapshot(data)
    const systemPrompt = `你是一个专业的中文简历优化助手。请基于用户提供的简历快照，对整份简历做整体优化。

优化要求：
1. 仅优化文本表达，让内容更专业、简洁、有说服力
2. 优先使用更强的动词、清晰的职责表述和更有结果导向的措辞
3. 仅在上下文已经明显暗示时，保守地补全可量化表达；不要编造夸张或虚假的经历
4. 联系方式、邮箱、电话、链接等事实信息不要改写；这些字段可能不会出现在输入中
5. 保持中文输出，不要添加解释、说明、Markdown 或代码块
6. 不要新增或删除任何条目，必须保留所有 id

你必须严格返回以下 JSON 结构，不要返回其他文字：
{
  "title": "优化后的标题",
  "personalInfo": [{ "id": "原始 id", "value": "优化后的值" }],
  "jobIntention": [{ "id": "原始 id", "value": "优化后的值" }],
  "moduleElements": [{ "id": "原始 id", "text": "优化后的文本" }],
  "moduleTags": [{ "id": "原始 id", "tags": ["优化后的标签"] }]
}

如果某项不需要修改，也必须保留原始 id，并返回原文。`

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `请优化以下简历快照：\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ]

    const raw = await this.chat(messages, { temperature: 0.4, maxTokens: 6000 })

    try {
      const result = parseJSONResponse<ResumeOptimizationResult>(raw)
      const validation = validateOptimizationResult(snapshot, result)
      return {
        resumeData: applyOptimizationResult(data, result),
        warnings: buildOptimizationWarnings(data, snapshot, validation),
      }
    } catch {
      throw new Error("AI 返回了无法解析的优化结果，请重试")
    }
  }

  async analyzeJD(jd: string, resumeText: string): Promise<JDAnalysisResult> {
    const systemPrompt = `你是一个专业的简历优化顾问。用户将提供一份目标职位描述（JD）和当前简历内容。
请分析简历与JD的匹配度，并给出具体的优化建议。

你必须严格按以下JSON格式返回，不要添加任何其他文字：
{
  "matchScore": <0-100的整数匹配度评分>,
  "missingKeywords": ["简历中缺失的JD关键技能或要求"],
  "matchedKeywords": ["简历中已匹配的JD关键技能"],
  "suggestions": [
    {
      "section": "简历中的模块名称（如'工作经历'、'项目经验'、'求职意向'等）",
      "field": "具体字段（如某个公司名或项目名，可选）",
      "originalText": "该部分的当前内容摘要",
      "suggestedText": "建议修改为的具体内容",
      "reason": "修改理由（简短说明为什么这样改能更好地匹配JD）"
    }
  ],
  "summary": "一段话总结简历与JD的整体匹配情况和最关键的改进方向"
}

注意：
- suggestions 应该只包含确实需要修改的部分，如果某部分已经很好就不要包含
- suggestedText 应该是完整的替换内容，而不是模糊的建议
- 如果简历某部分为空，suggestedText 应该是新写的完整内容
- 最多给出8条suggestions`

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `【目标职位描述（JD）】\n${jd}\n\n【当前简历内容】\n${resumeText}`,
      },
    ]

    const raw = await this.chat(messages, { temperature: 0.3, maxTokens: 4000 })

    const jsonStr = raw
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim()

    try {
      const result = JSON.parse(jsonStr) as JDAnalysisResult
      return result
    } catch {
      throw new Error("AI 返回了无法解析的内容，请重试")
    }
  }

  async rewriteForJD(
    sectionName: string,
    originalText: string,
    suggestion: string,
    jd: string
  ): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: "system",
        content:
          "你是一个专业的简历优化助手。请根据JD要求优化指定简历部分。直接返回优化后的完整文本，不要添加解释。",
      },
      {
        role: "user",
        content: `【目标JD】\n${jd}\n\n【简历模块】${sectionName}\n【当前内容】\n${originalText}\n\n【优化方向】\n${suggestion}\n\n请返回优化后的完整内容：`,
      },
    ]
    return this.chat(messages)
  }
}
