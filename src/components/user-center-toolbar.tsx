import { Icon } from '@iconify/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

interface UserCenterToolbarProps {
  itemsCount: number
  importing: boolean
  keyword: string
  hasItems: boolean
  selectedCount: number
  onKeywordChange: (value: string) => void
  onNavigateBoard: () => void
  onImport: () => void
  onCreate: () => void
  onDeleteSelected: () => void
}

export function UserCenterToolbar({
  itemsCount,
  importing,
  keyword,
  hasItems,
  selectedCount,
  onKeywordChange,
  onNavigateBoard,
  onImport,
  onCreate,
  onDeleteSelected,
}: UserCenterToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <Icon icon="mdi:account" className="text-primary h-6 w-6" />
        <h1 className="text-lg font-semibold">我的简历</h1>
        <Badge variant="secondary">{itemsCount}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="gap-2 bg-transparent" onClick={onNavigateBoard}>
          <Icon icon="mdi:view-kanban-outline" className="h-4 w-4" /> 回到求职看板
        </Button>
        {hasItems && (
          <>
            <Input
              placeholder="搜索简历名称"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              className="w-56"
            />
            {null}
            <Separator orientation="vertical" className="h-6" />
            <Button variant="default" className="gap-2" onClick={onImport} disabled={importing}>
              <Icon icon="mdi:import" className="h-4 w-4" /> 导入
            </Button>
            <Button onClick={onCreate} className="gap-2">
              <Icon icon="mdi:plus" className="h-4 w-4" /> 创建简历
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={selectedCount === 0}
              onClick={onDeleteSelected}
            >
              <Icon icon="mdi:trash-can" className="h-4 w-4" /> 批量删除
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
