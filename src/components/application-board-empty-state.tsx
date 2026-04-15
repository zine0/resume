import { Icon } from '@iconify/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ApplicationBoardEmptyStateProps {
  onCreate: () => void
  onNavigateResumes: () => void
}

export function ApplicationBoardEmptyState({
  onCreate,
  onNavigateResumes,
}: ApplicationBoardEmptyStateProps) {
  return (
    <Card className="bg-muted/30 mx-auto max-w-2xl gap-4 border-dashed p-10 text-center shadow-sm">
      <div className="bg-primary/10 text-primary mx-auto flex h-16 w-16 items-center justify-center rounded-full">
        <Icon icon="mdi:view-kanban-outline" className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">还没有求职记录</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          先创建第一条记录，把目标岗位放进看板；后续可直接拖拽到不同阶段，持续跟踪投递节奏。
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onCreate} className="gap-2">
          <Icon icon="mdi:plus" className="h-4 w-4" />
          新增第一条记录
        </Button>
        <Button variant="outline" onClick={onNavigateResumes} className="gap-2 bg-transparent">
          <Icon icon="mdi:file-document-outline" className="h-4 w-4" />
          前往简历库
        </Button>
      </div>
    </Card>
  )
}
