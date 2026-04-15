import { Icon } from '@iconify/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

interface ApplicationBoardHeaderProps {
  applicationsCount: number
  keyword: string
  resumeLoadFailed: boolean
  onKeywordChange: (value: string) => void
  onNavigateResumes: () => void
  onOpenAiSettings: () => void
  onCreate: () => void
}

export function ApplicationBoardHeader({
  applicationsCount,
  keyword,
  resumeLoadFailed,
  onKeywordChange,
  onNavigateResumes,
  onOpenAiSettings,
  onCreate,
}: ApplicationBoardHeaderProps) {
  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateResumes}
                className="gap-2 bg-transparent"
              >
                <Icon icon="mdi:file-document-multiple-outline" className="h-4 w-4" />
                简历库
              </Button>
              <Separator orientation="vertical" className="hidden h-6 md:block" />
              <div className="flex items-center gap-2">
                <Icon icon="mdi:view-kanban-outline" className="text-primary h-6 w-6" />
                <h1 className="text-lg font-semibold">求职看板</h1>
                <Badge variant="secondary">{applicationsCount}</Badge>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              把岗位、投递进度和结果放在同一块看板里统一推进，需要时再进入简历库管理版本。
            </p>
            {resumeLoadFailed ? (
              <p className="text-destructive text-sm">简历库加载失败，当前仍可继续管理求职记录。</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="搜索公司、岗位、下一步动作、JD 或备注..."
              className="w-full sm:w-72"
            />
            <Button variant="outline" onClick={onOpenAiSettings} className="gap-2 bg-transparent">
              <Icon icon="mdi:cog-outline" className="h-4 w-4" />
              AI 设置
            </Button>
            <Button onClick={onCreate} className="gap-2">
              <Icon icon="mdi:plus" className="h-4 w-4" />
              新增记录
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
