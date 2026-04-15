import type { ComponentProps, CSSProperties, ReactNode, RefCallback, RefObject } from 'react'
import { DndContext } from '@dnd-kit/core'
import type { ApplicationEntry, ApplicationStatus } from '@/types/application'

export interface StatusMeta {
  label: string
  icon: string
  surfaceClass: string
  badgeClass: string
  emptyCopy: string
}

export interface RenderApplicationCardArgs {
  application: ApplicationEntry
  linkedResumeTitle?: string
  tailoring: boolean
  isDragging: boolean
  fixedWidth?: number
  style?: CSSProperties
  setRef: RefCallback<HTMLDivElement>
  dragHandle?: ReactNode
  previewOnly?: boolean
  movingId: string | null
  onEdit: (application: ApplicationEntry) => void
  onDelete: (application: ApplicationEntry) => void
  onTailor: (application: ApplicationEntry) => Promise<void>
}

export interface BoardDraggableCardProps {
  application: ApplicationEntry
  linkedResumeTitle?: string
  tailoring: boolean
  movingId: string | null
  cardWidthsRef: RefObject<Map<string, number>>
  renderApplicationCard: (args: RenderApplicationCardArgs) => ReactNode
  onEdit: (application: ApplicationEntry) => void
  onDelete: (application: ApplicationEntry) => void
  onTailor: (application: ApplicationEntry) => Promise<void>
}

export interface BoardColumnProps {
  status: ApplicationStatus
  meta: StatusMeta
  items: ApplicationEntry[]
  movingId: string | null
  resumeTitleMap: Map<string, string>
  tailoringIds: string[]
  cardWidthsRef: RefObject<Map<string, number>>
  renderApplicationCard: (args: RenderApplicationCardArgs) => ReactNode
  onEdit: (application: ApplicationEntry) => void
  onDelete: (application: ApplicationEntry) => void
  onTailor: (application: ApplicationEntry) => Promise<void>
}

export interface ApplicationBoardKanbanProps {
  sensors: ComponentProps<typeof DndContext>['sensors']
  collisionDetection: ComponentProps<typeof DndContext>['collisionDetection']
  statusOrder: ApplicationStatus[]
  groupedApplications: Record<ApplicationStatus, ApplicationEntry[]>
  statusMeta: Record<ApplicationStatus, StatusMeta>
  movingId: string | null
  resumeTitleMap: Map<string, string>
  tailoringIds: string[]
  cardWidthsRef: RefObject<Map<string, number>>
  renderApplicationCard: (args: RenderApplicationCardArgs) => ReactNode
  activeApplication: ApplicationEntry | null
  activeLinkedResumeTitle?: string
  activeApplicationWidth?: number
  onDragStart: ComponentProps<typeof DndContext>['onDragStart']
  onDragEnd: ComponentProps<typeof DndContext>['onDragEnd']
  onDragCancel: ComponentProps<typeof DndContext>['onDragCancel']
  onEdit: (application: ApplicationEntry) => void
  onDelete: (application: ApplicationEntry) => void
  onTailor: (application: ApplicationEntry) => Promise<void>
}
