
import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@iconify/react"
import { useToast } from "@/hooks/use-toast"
import { getAIConfig } from "@/lib/ai-config"
import { AIService } from "@/lib/ai-service"
import type { JSONContent, ModuleContentRow, ResumeData, ResumeModule } from "@/types/resume"
import type { JDAnalysisResult, JDAnalysisSuggestion } from "@/types/ai"

interface JDAnalysisSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resumeData: ResumeData
  onCreateTailoredResume?: (data: ResumeData) => Promise<void> | void
}

interface TailorResult {
  data: ResumeData
  appliedCount: number
  unmatchedCount: number
}

function extractText(content: unknown): string {
  if (!content) return ""
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.map(extractText).join("")
  if (typeof content === "object" && content !== null) {
    const obj = content as Record<string, unknown>
    if (obj.type === "hardBreak") return "\n"
    if (obj.type === "text") return String(obj.text || "")
    if (obj.content) return extractText(obj.content)
  }
  return ""
}

function resumeToText(data: ResumeData): string {
  const lines: string[] = []

  lines.push(`【简历标题】${data.title}`)
  lines.push("")

  if (data.personalInfoSection?.personalInfo?.length) {
    lines.push("【个人信息】")
    for (const item of data.personalInfoSection.personalInfo) {
      lines.push(`  ${item.label}: ${item.value.content}`)
    }
    lines.push("")
  }

  if (data.jobIntentionSection?.enabled && data.jobIntentionSection.items?.length) {
    lines.push("【求职意向】")
    for (const item of data.jobIntentionSection.items) {
      if (item.type === "salary" && item.salaryRange) {
        const { min, max } = item.salaryRange
        lines.push(`  ${item.label}: ${min ?? ""}K-${max ?? ""}K`)
      } else {
        lines.push(`  ${item.label}: ${item.value}`)
      }
    }
    lines.push("")
  }

  for (const mod of data.modules) {
    lines.push(`【${mod.title}】`)
    for (const row of mod.rows) {
      if (row.type === "tags" && row.tags?.length) {
        lines.push(`  标签: ${row.tags.join(", ")}`)
      } else {
        const rowText = row.elements
          .map((el) => extractText(el.content))
          .filter(Boolean)
          .join(" | ")
        if (rowText) lines.push(`  ${rowText}`)
      }
    }
    lines.push("")
  }

  return lines.join("\n")
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, "").trim().toLowerCase()
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

function buildTailoredTitle(title: string): string {
  return /JD定制版/.test(title) ? title : `${title} - JD定制版`
}

function parseSalaryRange(text: string): { min?: number; max?: number } | null {
  const matches = Array.from(text.matchAll(/\d+/g)).map((match) => Number.parseInt(match[0], 10))
  if (matches.length === 0 || matches.some(Number.isNaN)) {
    return null
  }

  if (matches.length === 1) {
    if (/[起以上上]/.test(text)) {
      return { min: matches[0] }
    }
    if (/[以下内]/.test(text)) {
      return { max: matches[0] }
    }
    return { min: matches[0] }
  }

  return {
    min: Math.min(matches[0], matches[1]),
    max: Math.max(matches[0], matches[1]),
  }
}

function matchesSuggestionTarget(targetText: string, suggestion: JDAnalysisSuggestion): boolean {
  const normalizedTarget = normalizeText(targetText)
  const original = normalizeText(suggestion.originalText || "")
  const field = normalizeText(suggestion.field || "")

  if (normalizedTarget && original && (normalizedTarget.includes(original) || original.includes(normalizedTarget))) {
    return true
  }

  if (normalizedTarget && field && normalizedTarget.includes(field)) {
    return true
  }

  return false
}

function replaceInModule(module: ResumeModule, suggestion: JDAnalysisSuggestion): boolean {
  const normalizedSection = normalizeText(suggestion.section)
  const normalizedTitle = normalizeText(module.title)
  const sectionMatches = normalizedSection
    ? normalizedTitle.includes(normalizedSection) || normalizedSection.includes(normalizedTitle)
    : false

  if (!sectionMatches) {
    return false
  }

  for (const row of module.rows) {
    if (row.type === "tags") {
      const tagsText = row.tags?.join(", ") || ""
      if (matchesSuggestionTarget(tagsText, suggestion)) {
        row.type = "rich"
        row.tags = undefined
        row.columns = 1
        row.elements = [{
          id: `${row.id}-jd-tailored`,
          columnIndex: 0,
          content: textToRichContent(suggestion.suggestedText),
        }]
        return true
      }
      continue
    }

    for (const element of row.elements) {
      const elementText = extractText(element.content)
      if (matchesSuggestionTarget(elementText, suggestion)) {
        element.content = textToRichContent(suggestion.suggestedText)
        return true
      }
    }
  }

  const newRow: ModuleContentRow = {
    id: `${module.id}-jd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "rich",
    columns: 1,
    order: module.rows.length,
    elements: [{
      id: `${module.id}-jd-element-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      columnIndex: 0,
      content: textToRichContent(suggestion.suggestedText),
    }],
  }

  module.rows = [...module.rows, newRow]
  return true
}

function applySuggestionsToResume(resumeData: ResumeData, result: JDAnalysisResult): TailorResult {
  const next = cloneResumeData(resumeData)
  const now = new Date().toISOString()
  next.title = buildTailoredTitle(next.title)
  next.createdAt = now
  next.updatedAt = now

  let appliedCount = 0
  const unmatched: JDAnalysisSuggestion[] = []

  for (const suggestion of result.suggestions) {
    let applied = false
    const sectionKey = normalizeText(suggestion.section)
    const fieldKey = normalizeText(suggestion.field || "")

    if (sectionKey.includes("个人信息")) {
      const item = next.personalInfoSection.personalInfo.find((info) => (
        (fieldKey ? normalizeText(info.label).includes(fieldKey) : false)
        || matchesSuggestionTarget(info.value.content, suggestion)
      ))
      if (item) {
        item.value.content = suggestion.suggestedText
        applied = true
      }
    }

    if (!applied && sectionKey.includes("求职意向") && next.jobIntentionSection?.items?.length) {
      const item = next.jobIntentionSection.items.find((job) => (
        (fieldKey ? normalizeText(job.label).includes(fieldKey) : false)
        || matchesSuggestionTarget(job.value, suggestion)
      ))
      if (item) {
        if (item.type === "salary") {
          const parsedRange = parseSalaryRange(suggestion.suggestedText)
          if (parsedRange) {
            item.salaryRange = parsedRange
            item.value = suggestion.suggestedText
            applied = true
          }
        } else {
          item.value = suggestion.suggestedText
          applied = true
        }
      }
    }

    if (!applied) {
      const module = next.modules.find((candidate) => (
        sectionKey
          ? normalizeText(candidate.title).includes(sectionKey)
            || sectionKey.includes(normalizeText(candidate.title))
          : false
      ))
      if (module) {
        applied = replaceInModule(module, suggestion)
      }
    }

    if (applied) {
      appliedCount += 1
    } else {
      unmatched.push(suggestion)
    }
  }

  if (unmatched.length > 0) {
    const existingSuggestionModule = next.modules.find((module) => module.title === "JD 定制建议")
    const unmatchedRows = unmatched.map((suggestion, index) => ({
      id: `jd-tailoring-row-${Date.now()}-${index}`,
      type: "rich" as const,
      columns: 1 as const,
      order: index,
      elements: [{
        id: `jd-tailoring-element-${Date.now()}-${index}`,
        columnIndex: 0,
        content: textToRichContent(`${suggestion.section}${suggestion.field ? ` · ${suggestion.field}` : ""}\n${suggestion.suggestedText}`),
      }],
    }))

    if (existingSuggestionModule) {
      existingSuggestionModule.rows = [
        ...existingSuggestionModule.rows,
        ...unmatchedRows.map((row, index) => ({
          ...row,
          order: existingSuggestionModule.rows.length + index,
        })),
      ]
    } else {
    next.modules = [
      ...next.modules,
      {
        id: `jd-tailoring-${Date.now()}`,
        title: "JD 定制建议",
        order: next.modules.length,
        rows: unmatchedRows,
      },
    ]
    }
  }

  return { data: next, appliedCount, unmatchedCount: unmatched.length }
}

export default function JDAnalysisSheet({
  open,
  onOpenChange,
  resumeData,
  onCreateTailoredResume,
}: JDAnalysisSheetProps) {
  const { toast } = useToast()
  const [jdText, setJdText] = useState("")
  const [analysisResult, setAnalysisResult] = useState<JDAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [creatingCopy, setCreatingCopy] = useState(false)

  const handleAnalyze = async () => {
    if (!jdText.trim()) {
      toast({ title: "请先粘贴职位描述", variant: "destructive" })
      return
    }

    const config = await getAIConfig()
    if (!config) {
      toast({ title: "请先配置 AI 设置", variant: "destructive" })
      return
    }

    setAnalyzing(true)
    setAnalysisResult(null)
    try {
      const service = new AIService(config)
      const resumeText = resumeToText(resumeData)
      const result = await service.analyzeJD(jdText.trim(), resumeText)
      setAnalysisResult(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "分析失败"
      toast({ title: "分析失败", description: message, variant: "destructive" })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleApplySuggestion = async (suggestedText: string) => {
    try {
      await navigator.clipboard.writeText(suggestedText)
      toast({ title: "建议文本已复制到剪贴板" })
    } catch {
      toast({ title: "复制失败", variant: "destructive" })
    }
  }

  const handleCreateTailoredResume = async () => {
    if (!analysisResult) {
      toast({ title: "请先完成 JD 分析", variant: "destructive" })
      return
    }

    if (!onCreateTailoredResume) {
      toast({ title: "当前页面不支持生成副本", variant: "destructive" })
      return
    }

    setCreatingCopy(true)
    try {
      const tailored = applySuggestionsToResume(resumeData, analysisResult)
      await onCreateTailoredResume(tailored.data)
      toast({
        title: "已生成 JD 定制副本",
        description: tailored.unmatchedCount > 0
          ? `已应用 ${tailored.appliedCount} 条建议，另外 ${tailored.unmatchedCount} 条已附加到“JD 定制建议”模块。`
          : `已应用 ${tailored.appliedCount} 条建议，当前简历未被覆盖。`,
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成副本失败"
      toast({ title: "生成失败", description: message, variant: "destructive" })
    } finally {
      setCreatingCopy(false)
    }
  }

  const scoreColor =
    analysisResult && analysisResult.matchScore > 70
      ? "text-green-600 dark:text-green-400"
      : analysisResult && analysisResult.matchScore > 40
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>JD 匹配分析</SheetTitle>
          <SheetDescription>
            粘贴目标职位描述，AI 将分析简历与 JD 的匹配度
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6 pt-1">
          <div className="space-y-4">
            <Textarea
              placeholder="粘贴职位描述 (JD)..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="min-h-[160px] resize-y"
            />
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full gap-2"
            >
              {analyzing ? (
                <>
                  <Icon icon="lucide:loader-2" className="w-4 h-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Icon icon="mdi:magnify" className="w-4 h-4" />
                  开始分析
                </>
              )}
            </Button>
          </div>

          {analysisResult && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-3 py-5">
                <span className={`text-5xl font-bold ${scoreColor}`}>
                  {analysisResult.matchScore}
                </span>
                <span className="text-sm text-muted-foreground">匹配度</span>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">关键词匹配</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.matchedKeywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {kw}
                    </Badge>
                  ))}
                  {analysisResult.missingKeywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>

              {analysisResult.summary && (
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysisResult.summary}
                  </p>
                </Card>
              )}

              <Button
                onClick={() => void handleCreateTailoredResume()}
                disabled={creatingCopy || analysisResult.suggestions.length === 0}
                className="mt-1 w-full gap-2"
              >
                {creatingCopy ? (
                  <>
                    <Icon icon="lucide:loader-2" className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:file-plus-outline" className="w-4 h-4" />
                    生成 JD 定制副本（不覆盖当前简历）
                  </>
                )}
              </Button>

              {analysisResult.suggestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">
                    优化建议 ({analysisResult.suggestions.length})
                  </h3>
                  <div className="space-y-4">
                    {analysisResult.suggestions.map((s, i) => (
                      <Card key={i} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {s.section}
                            {s.field && (
                              <span className="text-muted-foreground"> · {s.field}</span>
                            )}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApplySuggestion(s.suggestedText)}
                            className="gap-1.5 bg-transparent"
                          >
                            <Icon icon="mdi:content-copy" className="w-3.5 h-3.5" />
                            复制
                          </Button>
                        </div>
                        {s.originalText && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            原文: {s.originalText}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed">
                          {s.suggestedText}
                        </p>
                        {s.reason && (
                          <p className="text-xs text-muted-foreground">
                            理由: {s.reason}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
