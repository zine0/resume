
import { useState } from "react"
import { Icon } from "@iconify/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { getAIConfig } from "@/lib/ai-config"
import { AIService } from "@/lib/ai-service"
import type { ResumeData } from "@/types/resume"

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
  const [optimizing, setOptimizing] = useState(false)

  const handleOptimize = async () => {
    if (!onCreateOptimizedResume) {
      toast({ title: "当前页面不支持生成副本", variant: "destructive" })
      return
    }

    const config = await getAIConfig()
    if (!config?.apiKey) {
      toast({ title: "请先配置 AI 设置", variant: "destructive" })
      return
    }

    setOptimizing(true)
    try {
      const service = new AIService(config)
      const outcome = await service.optimizeResume(resumeData)
      await onCreateOptimizedResume(outcome.resumeData)
      toast({
        title: outcome.warnings.length > 0 ? "已生成优化副本（含保留项）" : "已生成优化副本",
        description: outcome.warnings.length > 0
          ? outcome.warnings.slice(0, 2).join(" ")
          : "优化后的简历已另存为新副本，当前简历未被覆盖。",
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成优化副本失败"
      toast({ title: "生成失败", description: message, variant: "destructive" })
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>一键优化简历</DialogTitle>
          <DialogDescription>
            AI 会基于当前编辑器里的最新内容（包括未保存修改）生成新的优化副本，不会覆盖原始简历。
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Icon icon="mdi:auto-fix" className="mt-0.5 h-4 w-4 text-primary" />
              <span>整体优化标题、求职意向、模块内容和标签表达。</span>
            </div>
            <div className="flex items-start gap-2">
              <Icon icon="mdi:file-plus-outline" className="mt-0.5 h-4 w-4 text-primary" />
              <span>优化结果会另存为新简历副本，方便你对比和继续修改。</span>
            </div>
            <div className="flex items-start gap-2">
              <Icon icon="mdi:content-save-alert-outline" className="mt-0.5 h-4 w-4 text-primary" />
              <span>会直接读取当前编辑器里的内容；即使你还没点“保存”，这些修改也会参与优化。</span>
            </div>
            <div className="flex items-start gap-2">
              <Icon icon="mdi:shield-check-outline" className="mt-0.5 h-4 w-4 text-primary" />
              <span>联系方式、链接和复杂富文本会优先保留原样，避免误改事实信息或破坏格式。</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={optimizing}>
            取消
          </Button>
          <Button onClick={() => void handleOptimize()} disabled={optimizing} className="gap-2">
            {optimizing ? (
              <>
                <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                优化中...
              </>
            ) : (
              <>
                <Icon icon="mdi:sparkles" className="h-4 w-4" />
                生成优化副本
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
