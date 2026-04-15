import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Icon } from '@iconify/react'
import type { ResumeModule, ModuleContentRow, ModuleContentElement } from '@/types/resume'
import { createResumeModule, createRichTextRow, createTagsRow } from '@/lib/storage'
import { useToast } from '@/hooks/use-toast'
import IconPicker from './icon-picker'
import FloatingActionBar from './floating-action-bar'
import RichTextInput from './rich-text-input'
import TagInput from './tag-input'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ModuleEditorProps {
  modules: ResumeModule[]
  onUpdate: (modules: ResumeModule[]) => void
}

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>

function buildInlineSvgDataUrl(icon?: string) {
  if (!icon) return ''
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${icon}</svg>`)}`
}

export default function ModuleEditor({ modules, onUpdate }: ModuleEditorProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [isAddingModule, setIsAddingModule] = useState(false)
  const { toast } = useToast()
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )
  const sortedModules = [...modules].sort((a, b) => a.order - b.order)

  /**
   * 添加新模块
   */
  const addModule = async () => {
    if (isAddingModule) return
    try {
      setIsAddingModule(true)
      const nextOrder = modules.reduce((max, module) => Math.max(max, module.order), -1) + 1
      const newModule = await createResumeModule(nextOrder)
      const updatedModules = [...modules, newModule]
      onUpdate(updatedModules)
      setExpandedModules((prev) => new Set([...prev, newModule.id]))
    } catch (e) {
      toast({
        title: '添加失败',
        description: e instanceof Error ? e.message : '无法创建新的简历模块',
        variant: 'destructive',
      })
    } finally {
      setIsAddingModule(false)
    }
  }

  /**
   * 更新模块
   */
  const updateModule = (id: string, updates: Partial<ResumeModule>) => {
    const updatedModules = modules.map((module) =>
      module.id === id ? { ...module, ...updates } : module,
    )
    onUpdate(updatedModules)
  }

  /**
   * 删除模块
   */
  const removeModule = (id: string) => {
    const updatedModules = modules
      .filter((module) => module.id !== id)
      .map((module, index) => ({
        ...module,
        order: index,
      }))
    onUpdate(updatedModules)
    setExpandedModules((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  /**
   * 处理模块拖拽
   */
  const handleModuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedModules.findIndex((module) => module.id === active.id)
    const newIndex = sortedModules.findIndex((module) => module.id === over.id)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

    const updatedModules = arrayMove(sortedModules, oldIndex, newIndex).map((module, index) => ({
      ...module,
      order: index,
    }))

    onUpdate(updatedModules)
  }

  /**
   * 切换模块展开状态
   */
  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  return (
    <Card className="section-card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:view-module" className="text-primary h-5 w-5" />
          <h2 className="section-title">简历模块</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={addModule}
          disabled={isAddingModule}
          className="gap-2 bg-transparent"
        >
          <Icon icon="mdi:plus" className="h-4 w-4" />
          添加模块
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleModuleDragEnd}
      >
        <SortableContext
          items={sortedModules.map((module) => module.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sortedModules.map((module) => (
              <SortableModuleItem
                key={module.id}
                module={module}
                isExpanded={expandedModules.has(module.id)}
                onToggle={() => toggleModule(module.id)}
                onUpdate={(updates) => updateModule(module.id, updates)}
                onRemove={() => removeModule(module.id)}
              />
            ))}

            {modules.length === 0 && (
              <div className="text-muted-foreground py-8 text-center">
                <Icon icon="mdi:view-module-outline" className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">暂无简历模块，点击"添加模块"开始编辑</p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </Card>
  )
}

function SortableModuleItem({ module, ...props }: Omit<ModuleItemProps, 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
      }}
    >
      <ModuleItem module={module} dragHandleProps={{ attributes, listeners }} {...props} />
    </div>
  )
}

/**
 * 单个模块组件
 */
interface ModuleItemProps {
  module: ResumeModule
  isExpanded: boolean
  dragHandleProps: SortableHandleProps | null
  onToggle: () => void
  onUpdate: (updates: Partial<ResumeModule>) => void
  onRemove: () => void
}

function ModuleItem({
  module,
  isExpanded,
  dragHandleProps,
  onToggle,
  onUpdate,
  onRemove,
}: ModuleItemProps) {
  const { toast } = useToast()
  const [isAddingRow, setIsAddingRow] = useState(false)

  /**
   * 添加新行
   */
  const addRow = async (columns: 1 | 2 | 3 | 4, afterRowId?: string) => {
    if (isAddingRow) return
    const rows = [...module.rows]
    const afterIndex = afterRowId ? rows.findIndex((r) => r.id === afterRowId) : -1
    const insertIndex = afterIndex >= 0 ? afterIndex + 1 : rows.length
    try {
      setIsAddingRow(true)
      const newRow = await createRichTextRow(columns, insertIndex)
      rows.splice(insertIndex, 0, newRow)
      // 重新计算 order，保证排序正确
      rows.forEach((r, i) => {
        r.order = i
      })
      onUpdate({ rows })
    } catch (e) {
      toast({
        title: '添加失败',
        description: e instanceof Error ? e.message : '无法创建新的内容行',
        variant: 'destructive',
      })
    } finally {
      setIsAddingRow(false)
    }
  }

  /**
   * 添加标签行
   */
  const addTagsRow = async (afterRowId?: string) => {
    if (isAddingRow) return
    const rows = [...module.rows]
    const afterIndex = afterRowId ? rows.findIndex((r) => r.id === afterRowId) : -1
    const insertIndex = afterIndex >= 0 ? afterIndex + 1 : rows.length
    try {
      setIsAddingRow(true)
      const newRow = await createTagsRow(insertIndex)
      rows.splice(insertIndex, 0, newRow)
      rows.forEach((r, i) => {
        r.order = i
      })
      onUpdate({ rows })
    } catch (e) {
      toast({
        title: '添加失败',
        description: e instanceof Error ? e.message : '无法创建新的标签行',
        variant: 'destructive',
      })
    } finally {
      setIsAddingRow(false)
    }
  }

  /**
   * 更新行
   */
  const updateRow = (rowId: string, updates: Partial<ModuleContentRow>) => {
    const updatedRows = module.rows.map((row) => (row.id === rowId ? { ...row, ...updates } : row))
    onUpdate({ rows: updatedRows })
  }

  /**
   * 删除行
   */
  const removeRow = (rowId: string) => {
    const updatedRows = module.rows
      .filter((row) => row.id !== rowId)
      .map((row, index) => ({
        ...row,
        order: index,
      }))
    onUpdate({ rows: updatedRows })
  }

  /**
   * 更新元素
   */
  const updateElement = (
    rowId: string,
    elementId: string,
    updates: Partial<ModuleContentElement>,
  ) => {
    const updatedRows = module.rows.map((row) => {
      if (row.id === rowId) {
        const updatedElements = row.elements.map((el) =>
          el.id === elementId ? { ...el, ...updates } : el,
        )
        return { ...row, elements: updatedElements }
      }
      return row
    })
    onUpdate({ rows: updatedRows })
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  return (
    <>
      <div className="bg-muted/30 rounded-lg border">
        {/* 模块头部 */}
        <div className="hover:bg-muted/50 relative p-3 transition-colors">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggle}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              {module.icon ? (
                <img src={buildInlineSvgDataUrl(module.icon)} alt="模块图标" className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 rounded-sm border border-dashed border-gray-400" />
              )}
              <span className="truncate font-medium">{module.title || '未命名模块'}</span>
              <Icon
                icon={isExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                className="text-muted-foreground ml-auto h-4 w-4"
              />
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteConfirm(true)
              }}
              aria-label="删除"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
            >
              <Icon icon="mdi:delete" className="h-4 w-4" />
            </Button>
            <button
              type="button"
              {...dragHandleProps?.attributes}
              {...dragHandleProps?.listeners}
              onClick={(e) => e.stopPropagation()}
              aria-label="拖拽排序"
              className="text-muted-foreground flex h-8 w-8 cursor-grab items-center justify-center active:cursor-grabbing"
            >
              <Icon icon="mdi:drag" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 模块内容 */}
        {isExpanded && (
          <div className="space-y-4 border-t p-3 pt-0">
            {/* 模块设置 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <Input
                  value={module.title}
                  onChange={(e) => onUpdate({ title: e.target.value })}
                  placeholder="如：工作经历、教育背景"
                />
              </div>
              <div className="form-group">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
                      {module.icon ? (
                        <img
                          src={buildInlineSvgDataUrl(module.icon)}
                          alt="当前图标"
                          className="h-4 w-4"
                        />
                      ) : (
                        <div className="h-4 w-4 rounded-sm border border-dashed border-gray-400" />
                      )}
                      选择图标
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>选择图标</DialogTitle>
                    </DialogHeader>
                    <IconPicker
                      selectedIcon={module.icon}
                      onSelect={(icon) => onUpdate({ icon })}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* 内容行列表 */}
            <div className="space-y-0.5">
              {module.rows.length === 0 ? (
                <EmptyRowPlaceholder onAddRow={addRow} onAddTagsRow={() => addTagsRow()} />
              ) : (
                module.rows
                  .sort((a, b) => a.order - b.order)
                  .map((row) => (
                    <ContentRowEditor
                      key={row.id}
                      row={row}
                      onUpdate={(updates) => updateRow(row.id, updates)}
                      onRemove={() => removeRow(row.id)}
                      onUpdateElement={(elementId, updates) =>
                        updateElement(row.id, elementId, updates)
                      }
                      onAddRow={addRow}
                      onAddTagsRow={() => addTagsRow(row.id)}
                    />
                  ))
              )}
            </div>

            {/* 已有行时通过悬浮最后一行添加，不再显示底部占位 */}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除模块"{module.title}"及其所有内容吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemove()
                setShowDeleteConfirm(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * 内容行编辑器
 */
interface ContentRowEditorProps {
  row: ModuleContentRow
  onUpdate: (updates: Partial<ModuleContentRow>) => void
  onRemove: () => void
  onUpdateElement: (elementId: string, updates: Partial<ModuleContentElement>) => void
  onAddRow: (columns: 1 | 2 | 3 | 4, afterRowId?: string) => Promise<void>
  onAddTagsRow?: () => Promise<void>
}

/**
 * 空行占位符组件
 */
interface EmptyRowPlaceholderProps {
  onAddRow: (columns: 1 | 2 | 3 | 4, afterRowId?: string) => Promise<void>
  onAddTagsRow?: () => Promise<void>
}

function EmptyRowPlaceholder({ onAddRow, onAddTagsRow }: EmptyRowPlaceholderProps) {
  return (
    <div className="group relative pb-5">
      <div className="text-muted-foreground relative rounded-lg border-2 border-dashed py-6 text-center">
        <p className="text-sm">暂无内容，悬浮到此处添加行</p>

        <div className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <FloatingActionBar onAddRow={onAddRow} onAddTagsRow={onAddTagsRow} onDelete={() => {}} />
        </div>
      </div>
    </div>
  )
}

function ContentRowEditor({
  row,
  onUpdate,
  onRemove,
  onUpdateElement,
  onAddRow,
  onAddTagsRow,
}: ContentRowEditorProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = () => {
    onRemove()
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <div className="group relative pb-5">
        <div className="relative rounded-lg border bg-white">
          {row.type === 'tags' ? (
            <div className="p-2">
              <TagInput
                value={row.tags || []}
                onChange={(tags) => onUpdate({ tags })}
                maxTags={20}
                placeholder="输入标签后回车添加"
              />
            </div>
          ) : (
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${row.columns}, 1fr)`,
              }}
            >
              {row.elements.map((element, index) => (
                <div key={element.id} className={index < row.elements.length - 1 ? 'border-r' : ''}>
                  <RichTextInput
                    element={element}
                    onChange={(updates) => onUpdateElement(element.id, updates)}
                    placeholder="输入内容..."
                  />
                </div>
              ))}
            </div>
          )}

          <div className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
            <FloatingActionBar
              onAddRow={(columns) => onAddRow(columns, row.id)}
              onAddTagsRow={onAddTagsRow}
              onDelete={() => setShowDeleteConfirm(true)}
            />
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>您确定要删除这一行吗？此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
