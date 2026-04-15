import type { RefCallback } from 'react'
import { Icon } from '@iconify/react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { BoardDraggableCardProps } from '@/components/application-board-types'

export function BoardDraggableCard({
  application,
  linkedResumeTitle,
  tailoring,
  movingId,
  cardWidthsRef,
  renderApplicationCard,
  onEdit,
  onDelete,
  onTailor,
}: BoardDraggableCardProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: application.id,
    data: {
      status: application.status,
    },
  })

  const setMeasuredRef: RefCallback<HTMLDivElement> = (node) => {
    setNodeRef(node)
    if (node) {
      cardWidthsRef.current.set(application.id, node.getBoundingClientRect().width)
    } else {
      cardWidthsRef.current.delete(application.id)
    }
  }

  return renderApplicationCard({
    application,
    linkedResumeTitle,
    tailoring,
    isDragging,
    style: {
      opacity: isDragging ? 0.12 : undefined,
      transform: CSS.Translate.toString(transform),
    },
    setRef: setMeasuredRef,
    movingId,
    onEdit,
    onDelete,
    onTailor,
    dragHandle: (
      <button
        type="button"
        className={cn(
          'text-muted-foreground hover:bg-muted inline-flex size-8 cursor-grab items-center justify-center rounded-md transition-colors active:cursor-grabbing',
          isDragging && 'cursor-grabbing',
        )}
        aria-label="拖拽调整状态"
        {...listeners}
        {...attributes}
      >
        <Icon icon="mdi:drag" className="h-4 w-4" />
      </button>
    ),
  })
}
