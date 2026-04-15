import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { aiOptimizeResume, applyAiPatchToResumeData } from '@/lib/ai-service'
import type { AiOptimizationPreviewItem, AiOptimizeResumeResult } from '@/types/ai'
import type { ResumeData } from '@/types/resume'

interface FullResumeOptimizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resumeData: ResumeData
  onCreateOptimizedResume?: (data: ResumeData) => Promise<void> | void
}

export default function FullResumeOptimizationDialog({
  open,
  onOpenChange,
  resumeData,
  onCreateOptimizedResume,
}: FullResumeOptimizationDialogProps) {
  const { toast } = useToast()
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [creatingCopy, setCreatingCopy] = useState(false)
  const [previewResult, setPreviewResult] = useState<AiOptimizeResumeResult | null>(null)

  useEffect(() => {
    if (!open) {
      setGeneratingPreview(false)
      setCreatingCopy(false)
      setPreviewResult(null)
    }
  }, [open])

  const renderItemTitle = (item: AiOptimizationPreviewItem) => {
    const suffix =
      item.contentKind === 'tags'
        ? '标签'
        : item.contentKind === 'salary'
          ? '薪资'
          : item.contentKind === 'markdown'
            ? '内容'
            : '文本'

    return item.field ? `${item.field} · ${suffix}` : suffix
  }

  const handleGeneratePreview = async () => {
    if (!onCreateOptimizedResume) {
      toast({ title: '当前页面不支持生成副本', variant: 'destructive' })
      return
    }

    setGeneratingPreview(true)
    try {
      const result = await aiOptimizeResume(resumeData)
      setPreviewResult(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成优化预览失败'
      toast({ title: '预览失败', description: message, variant: 'destructive' })
    } finally {
      setGeneratingPreview(false)
    }
  }

  const handleCreateOptimizedCopy = async () => {
    if (!previewResult) {
      toast({ title: '请先生成优化预览', variant: 'destructive' })
      return
    }

    if (!onCreateOptimizedResume) {
      toast({ title: '当前页面不支持生成副本', variant: 'destructive' })
      return
    }

    setCreatingCopy(true)
    try {
      const { data } = applyAiPatchToResumeData(resumeData, previewResult.patch)
      await onCreateOptimizedResume(data)
      toast({
        title: previewResult.warnings.length > 0 ? '已生成优化副本（含保留项）' : '已生成优化副本',
        description:
          previewResult.warnings.length > 0
            ? previewResult.warnings.slice(0, 2).join(' ')
            : '优化后的简历已另存为新副本，当前简历未被覆盖。',
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成优化副本失败'
      toast({ title: '生成失败', description: message, variant: 'destructive' })
    } finally {
      setCreatingCopy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>一键优化简历</DialogTitle>
          <DialogDescription>
            AI
            会先基于当前编辑器里的最新内容生成优化预览；确认后才会创建新的优化副本，原始简历不会被覆盖。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4 py-1">
            <div className="bg-muted/30 rounded-lg border p-4">
              <div className="text-muted-foreground space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Icon icon="mdi:auto-fix" className="text-primary mt-0.5 h-4 w-4" />
                  <span>整体优化标题、求职意向、模块内容和标签表达。</span>
                </div>
                <div className="flex items-start gap-2">
                  <Icon icon="mdi:file-plus-outline" className="text-primary mt-0.5 h-4 w-4" />
                  <span>确认后才会另存为新简历副本，方便你对比和继续修改。</span>
                </div>
                <div className="flex items-start gap-2">
                  <Icon
                    icon="mdi:content-save-alert-outline"
                    className="text-primary mt-0.5 h-4 w-4"
                  />
                  <span>
                    会直接读取当前编辑器里的内容；即使你还没点“保存”，这些修改也会参与优化。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Icon icon="mdi:shield-check-outline" className="text-primary mt-0.5 h-4 w-4" />
                  <span>
                    联系方式、链接和复杂富文本会优先保留原样，避免误改事实信息或破坏格式。
                  </span>
                </div>
              </div>
            </div>

            {previewResult && (
              <div className="space-y-4">
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">优化预览摘要</div>
                    <Badge variant="outline">{previewResult.previewItems.length} 处变更</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {previewResult.summary}
                  </p>
                </Card>

                {previewResult.warnings.length > 0 && (
                  <Card className="space-y-3 border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                      <Icon icon="mdi:alert-outline" className="h-4 w-4" />
                      保留与校验提示
                    </div>
                    <ul className="space-y-2 text-sm text-amber-900 dark:text-amber-200">
                      {previewResult.warnings.map((warning) => (
                        <li key={warning} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-current" />
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">预计变更内容</h3>
                      <p className="text-muted-foreground text-xs">
                        这里只展示经校验后真正发生变化的条目；确认后才会生成新的优化副本。
                      </p>
                    </div>
                  </div>

                  {previewResult.changeGroups.length > 0 ? (
                    <div className="space-y-4">
                      {previewResult.changeGroups.map((group) => (
                        <Card key={group.section} className="space-y-4 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium">{group.section}</h4>
                            <Badge variant="secondary">{group.items.length} 项</Badge>
                          </div>
                          <div className="space-y-4">
                            {group.items.map((item) => (
                              <div
                                key={`${item.targetKind}-${item.targetId}`}
                                className="space-y-2"
                              >
                                <div className="text-sm font-medium">{renderItemTitle(item)}</div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="bg-muted/40 rounded-md border p-3">
                                    <div className="text-muted-foreground mb-1 text-xs">原文</div>
                                    <p className="text-sm break-words whitespace-pre-wrap">
                                      {item.originalText || '（空）'}
                                    </p>
                                  </div>
                                  <div className="bg-primary/5 border-primary/10 rounded-md border p-3">
                                    <div className="text-primary mb-1 text-xs">优化后</div>
                                    <p className="text-sm break-words whitespace-pre-wrap">
                                      {item.optimizedText || '（空）'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-4">
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        当前没有可展示的差异项；如果你仍然确认，系统会按返回补丁创建新的优化副本。
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generatingPreview || creatingCopy}
          >
            取消
          </Button>
          {previewResult ? (
            <>
              <Button
                variant="outline"
                onClick={() => void handleGeneratePreview()}
                disabled={generatingPreview || creatingCopy}
                className="gap-2"
              >
                {generatingPreview ? (
                  <>
                    <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                    重新生成中...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:refresh" className="h-4 w-4" />
                    重新生成预览
                  </>
                )}
              </Button>
              <Button
                onClick={() => void handleCreateOptimizedCopy()}
                disabled={generatingPreview || creatingCopy}
                className="gap-2"
              >
                {creatingCopy ? (
                  <>
                    <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:file-plus-outline" className="h-4 w-4" />
                    确认并生成优化副本
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => void handleGeneratePreview()}
              disabled={generatingPreview}
              className="gap-2"
            >
              {generatingPreview ? (
                <>
                  <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                  生成预览中...
                </>
              ) : (
                <>
                  <Icon icon="mdi:sparkles" className="h-4 w-4" />
                  生成优化预览
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
