import { Icon } from '@iconify/react'
import { useDroppable } from '@dnd-kit/core'
import { BoardDraggableCard } from '@/components/application-board-draggable-card'
import type { BoardColumnProps } from '@/components/application-board-types'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function BoardColumn({
  status,
  meta,
  items,
  movingId,
  resumeTitleMap,
  tailoringIds,
  cardWidthsRef,
  renderApplicationCard,
  onEdit,
  onDelete,
  onTailor,
}: BoardColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
    data: { status },
  })

  return (
    <Card className="h-full w-full min-w-0 gap-4 py-4">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-lg border p-2', meta.surfaceClass)}>
            <Icon icon={meta.icon} className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{meta.label}</h2>
            <p className="text-muted-foreground text-xs">拖拽手柄即可变更状态</p>
          </div>
        </div>
        <Badge variant="outline" className={meta.badgeClass}>
          {items.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'relative mx-3 min-h-[380px] rounded-xl border border-dashed p-3 transition-colors',
          meta.surfaceClass,
          isOver && 'ring-ring/30 ring-2',
        )}
      >
        {items.length === 0 ? (
          <div className="text-muted-foreground pointer-events-none absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center text-sm leading-relaxed whitespace-normal">
            {meta.emptyCopy}
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((application) => {
            const tailoring = tailoringIds.includes(application.id)
            const linkedResumeTitle =
              application.resumeTitle ||
              (application.resumeId ? resumeTitleMap.get(application.resumeId) : undefined)

            return (
              <BoardDraggableCard
                key={application.id}
                application={application}
                linkedResumeTitle={linkedResumeTitle}
                tailoring={tailoring}
                movingId={movingId}
                cardWidthsRef={cardWidthsRef}
                renderApplicationCard={renderApplicationCard}
                onEdit={onEdit}
                onDelete={onDelete}
                onTailor={onTailor}
              />
            )
          })}
        </div>
      </div>
    </Card>
  )
}
