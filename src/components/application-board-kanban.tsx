import { DndContext, DragOverlay } from '@dnd-kit/core'
import { Icon } from '@iconify/react'
import { BoardColumn } from '@/components/application-board-column'
import type { ApplicationBoardKanbanProps } from '@/components/application-board-types'

function noopRef() {}

export function ApplicationBoardKanban({
  sensors,
  collisionDetection,
  statusOrder,
  groupedApplications,
  statusMeta,
  movingId,
  resumeTitleMap,
  tailoringIds,
  cardWidthsRef,
  renderApplicationCard,
  activeApplication,
  activeLinkedResumeTitle,
  activeApplicationWidth,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onEdit,
  onDelete,
  onTailor,
}: ApplicationBoardKanbanProps) {
  return (
    <div className="w-full overflow-visible">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] items-start gap-4 pb-4">
          {statusOrder.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              meta={statusMeta[status]}
              items={groupedApplications[status]}
              movingId={movingId}
              resumeTitleMap={resumeTitleMap}
              tailoringIds={tailoringIds}
              cardWidthsRef={cardWidthsRef}
              renderApplicationCard={renderApplicationCard}
              onEdit={onEdit}
              onDelete={onDelete}
              onTailor={onTailor}
            />
          ))}
        </div>

        <DragOverlay>
          {activeApplication
            ? renderApplicationCard({
                application: activeApplication,
                linkedResumeTitle: activeLinkedResumeTitle,
                tailoring: tailoringIds.includes(activeApplication.id),
                isDragging: true,
                fixedWidth: activeApplicationWidth,
                setRef: noopRef,
                previewOnly: true,
                movingId,
                onEdit: () => {},
                onDelete: () => {},
                onTailor: async () => {},
                dragHandle: (
                  <button
                    type="button"
                    className="text-muted-foreground inline-flex size-8 items-center justify-center rounded-md"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <Icon icon="mdi:drag" className="h-4 w-4" />
                  </button>
                ),
              })
            : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
