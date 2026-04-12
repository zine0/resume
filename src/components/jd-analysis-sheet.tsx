import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@iconify/react'
import { useToast } from '@/hooks/use-toast'
import { aiAnalyzeJD, applyAiPatchToResumeData, JD_SUGGESTION_MODULE_TITLE } from '@/lib/ai-service'
import type { ResumeData } from '@/types/resume'
import type { AiResumePatch, JDAnalysisResult, JDAnalysisSuggestion } from '@/types/ai'

interface JDAnalysisSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resumeData: ResumeData
  onCreateTailoredResume?: (data: ResumeData) => Promise<void> | void
  onApplySuggestion?: (data: ResumeData, suggestion: JDAnalysisSuggestion) => Promise<void> | void
}

function isSuggestionDirectlyApplicable(suggestion: JDAnalysisSuggestion) {
  return Boolean(suggestion.targetKind && suggestion.targetId)
}

function buildSuggestionPatch(suggestion: JDAnalysisSuggestion): AiResumePatch | null {
  if (!suggestion.targetKind || !suggestion.targetId) {
    return null
  }

  return {
    warnings: [],
    operations: [
      {
        targetKind: suggestion.targetKind,
        targetId: suggestion.targetId,
        contentKind: suggestion.contentKind,
        text: suggestion.suggestedText,
        tags: suggestion.tags,
        salaryRange: suggestion.salaryRange,
      },
    ],
  }
}

export default function JDAnalysisSheet({
  open,
  onOpenChange,
  resumeData,
  onCreateTailoredResume,
  onApplySuggestion,
}: JDAnalysisSheetProps) {
  const { toast } = useToast()
  const [jdText, setJdText] = useState('')
  const [analysisResult, setAnalysisResult] = useState<JDAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [creatingCopy, setCreatingCopy] = useState(false)
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!jdText.trim()) {
      toast({ title: '请先粘贴职位描述', variant: 'destructive' })
      return
    }

    setAnalyzing(true)
    setAnalysisResult(null)
    try {
      const result = await aiAnalyzeJD(resumeData, jdText.trim())
      setAnalysisResult(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败'
      toast({ title: '分析失败', description: message, variant: 'destructive' })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleApplySuggestion = async (suggestedText: string) => {
    try {
      await navigator.clipboard.writeText(suggestedText)
      toast({ title: '建议文本已复制到剪贴板' })
    } catch {
      toast({ title: '复制失败', variant: 'destructive' })
    }
  }

  const handleApplyToCurrentResume = async (suggestion: JDAnalysisSuggestion, index: number) => {
    const patch = buildSuggestionPatch(suggestion)
    if (!patch) {
      toast({
        title: '该建议暂不支持直接应用',
        description: '请复制后手动调整，或生成 JD 定制副本。',
      })
      return
    }

    if (!onApplySuggestion) {
      toast({ title: '当前页面不支持直接应用', variant: 'destructive' })
      return
    }

    const applyKey = `${suggestion.targetKind}-${suggestion.targetId}-${index}`
    setApplyingSuggestionId(applyKey)
    try {
      const { data } = applyAiPatchToResumeData(resumeData, patch, { keepCreatedAt: true })
      await onApplySuggestion(data, suggestion)
      toast({
        title: '已应用到当前简历',
        description: '编辑区内容已同步更新，记得按需保存或继续微调。',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '应用建议失败'
      toast({ title: '应用失败', description: message, variant: 'destructive' })
    } finally {
      setApplyingSuggestionId(null)
    }
  }

  const handleCreateTailoredResume = async () => {
    if (!analysisResult) {
      toast({ title: '请先完成 JD 分析', variant: 'destructive' })
      return
    }

    if (!onCreateTailoredResume) {
      toast({ title: '当前页面不支持生成副本', variant: 'destructive' })
      return
    }

    setCreatingCopy(true)
    try {
      const { data, appliedCount, unmatchedCount } = applyAiPatchToResumeData(
        resumeData,
        analysisResult.patch,
        { fallbackModuleTitle: JD_SUGGESTION_MODULE_TITLE },
      )
      await onCreateTailoredResume(data)
      toast({
        title: '已生成 JD 定制副本',
        description:
          unmatchedCount > 0
            ? `已应用 ${appliedCount} 条建议，另外 ${unmatchedCount} 条已附加到"${JD_SUGGESTION_MODULE_TITLE}"模块。`
            : `已应用 ${appliedCount} 条建议，当前简历未被覆盖。`,
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成副本失败'
      toast({ title: '生成失败', description: message, variant: 'destructive' })
    } finally {
      setCreatingCopy(false)
    }
  }

  const scoreColor =
    analysisResult && analysisResult.matchScore > 70
      ? 'text-green-600 dark:text-green-400'
      : analysisResult && analysisResult.matchScore > 40
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>JD 匹配分析</SheetTitle>
          <SheetDescription>粘贴目标职位描述，AI 将分析简历与 JD 的匹配度</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pt-1 pb-6">
          <div className="space-y-4">
            <Textarea
              placeholder="粘贴职位描述 (JD)..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="min-h-[160px] resize-y"
            />
            <Button onClick={handleAnalyze} disabled={analyzing} className="w-full gap-2">
              {analyzing ? (
                <>
                  <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Icon icon="mdi:magnify" className="h-4 w-4" />
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
                <span className="text-muted-foreground text-sm">匹配度</span>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">关键词匹配</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.matchedKeywords.map((kw) => (
                    <Badge
                      key={kw}
                      variant="secondary"
                      className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    >
                      {kw}
                    </Badge>
                  ))}
                  {analysisResult.missingKeywords.map((kw) => (
                    <Badge
                      key={kw}
                      variant="secondary"
                      className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>

              {analysisResult.summary && (
                <Card className="p-4">
                  <p className="text-muted-foreground text-sm leading-relaxed">
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
                    <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:file-plus-outline" className="h-4 w-4" />
                    生成 JD 定制副本（不覆盖当前简历）
                  </>
                )}
              </Button>

              {analysisResult.suggestions.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      优化建议 ({analysisResult.suggestions.length})
                    </h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      可直接定位到字段的建议支持“应用”，其余建议仍可复制，或统一生成 JD 定制副本。
                    </p>
                  </div>
                  <div className="space-y-4">
                    {analysisResult.suggestions.map((s, i) => (
                      <Card key={i} className="space-y-3 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">
                                {s.section}
                                {s.field && (
                                  <span className="text-muted-foreground"> · {s.field}</span>
                                )}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  isSuggestionDirectlyApplicable(s)
                                    ? 'bg-primary/5 text-primary border-primary/20'
                                    : 'text-muted-foreground'
                                }
                              >
                                {isSuggestionDirectlyApplicable(s) ? '可直接应用' : '需手动处理'}
                              </Badge>
                            </div>
                            {s.originalText && (
                              <p className="text-muted-foreground line-clamp-2 text-xs">
                                原文: {s.originalText}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 self-start">
                            <Button
                              size="sm"
                              disabled={
                                !onApplySuggestion ||
                                !isSuggestionDirectlyApplicable(s) ||
                                applyingSuggestionId === `${s.targetKind}-${s.targetId}-${i}`
                              }
                              onClick={() => void handleApplyToCurrentResume(s, i)}
                              className="gap-1.5"
                            >
                              {applyingSuggestionId === `${s.targetKind}-${s.targetId}-${i}` ? (
                                <>
                                  <Icon
                                    icon="lucide:loader-2"
                                    className="h-3.5 w-3.5 animate-spin"
                                  />
                                  应用中...
                                </>
                              ) : (
                                <>
                                  <Icon icon="mdi:check-bold" className="h-3.5 w-3.5" />
                                  应用
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApplySuggestion(s.suggestedText)}
                              className="gap-1.5 bg-transparent"
                            >
                              <Icon icon="mdi:content-copy" className="h-3.5 w-3.5" />
                              复制
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed">{s.suggestedText}</p>
                        {s.reason && (
                          <p className="text-muted-foreground text-xs">理由: {s.reason}</p>
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
