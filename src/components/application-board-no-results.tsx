import { Icon } from '@iconify/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ApplicationBoardNoResultsProps {
  onClear: () => void
}

export function ApplicationBoardNoResults({ onClear }: ApplicationBoardNoResultsProps) {
  return (
    <Card className="bg-muted/30 mx-auto max-w-xl gap-3 border-dashed p-8 text-center shadow-sm">
      <div className="text-muted-foreground mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-dashed">
        <Icon icon="mdi:magnify" className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold">没有匹配到记录</h2>
      <p className="text-muted-foreground text-sm">试试更换关键词，或直接新增一条新的求职记录。</p>
      <div className="flex justify-center">
        <Button variant="outline" onClick={onClear} className="gap-2 bg-transparent">
          <Icon icon="mdi:close-circle-outline" className="h-4 w-4" />
          清空搜索
        </Button>
      </div>
    </Card>
  )
}
