import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Icon } from '@iconify/react'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { JobIntentionItem, JobIntentionSection } from '@/types/resume'
import { createJobIntentionItem } from '@/lib/storage'
import { useToast } from '@/hooks/use-toast'

interface JobIntentionEditorProps {
  jobIntentionSection?: JobIntentionSection
  onUpdate: (jobIntentionSection: JobIntentionSection) => void
}

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>

/**
 * 求职意向编辑器组件
 */
export default function JobIntentionEditor({
  jobIntentionSection,
  onUpdate,
}: JobIntentionEditorProps) {
  const { toast } = useToast()
  const [isAddingItem, setIsAddingItem] = useState(false)
  const enabled = jobIntentionSection?.enabled ?? true
  const items = jobIntentionSection?.items || []
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )
  const sortedItems = [...items].sort((a, b) => a.order - b.order)

  /**
   * 处理拖拽排序结束事件
   */
  const handleDragEnd = (event: DragEndEvent) => {
    if (!enabled) return

    const { active, over } = event
    if (!over || active.id === over.id) return

    const sourceIndex = sortedItems.findIndex((item) => item.id === active.id)
    const destinationIndex = sortedItems.findIndex((item) => item.id === over.id)

    if (sourceIndex < 0 || destinationIndex < 0 || sourceIndex === destinationIndex) return

    const reorderedItems = arrayMove(sortedItems, sourceIndex, destinationIndex)

    // 更新order字段
    const updatedItems = reorderedItems.map((item, index) => ({
      ...item,
      order: index,
    }))

    onUpdate({
      items: updatedItems,
      enabled,
    })
  }

  /**
   * 切换启用状态
   */
  const toggleEnabled = () => {
    const newEnabled = !enabled
    onUpdate({
      items,
      enabled: newEnabled,
    })
  }

  /**
   * 更新求职意向项
   */
  const updateItem = (id: string, updates: Partial<JobIntentionItem>) => {
    const updatedItems = items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    onUpdate({
      items: updatedItems,
      enabled,
    })
  }

  /**
   * 添加新的求职意向项
   */
  const addItem = async (type: 'workYears' | 'position' | 'city' | 'salary' | 'custom') => {
    if (items.length >= 6 || isAddingItem) {
      return
    }
    try {
      setIsAddingItem(true)
      const nextOrder = items.reduce((max, item) => Math.max(max, item.order), -1) + 1
      const newItem = await createJobIntentionItem(type, nextOrder)
      onUpdate({
        items: [...items, newItem],
        enabled,
      })
    } catch (e) {
      toast({
        title: '添加失败',
        description: e instanceof Error ? e.message : '无法创建新的求职意向项',
        variant: 'destructive',
      })
    } finally {
      setIsAddingItem(false)
    }
  }

  /**
   * 检查某个类型是否已存在
   */
  const hasType = (type: string) => {
    return items.some((item) => item.type === type)
  }

  /**
   * 获取可添加的类型列表
   */
  const getAvailableTypes = () => {
    return [
      {
        type: 'workYears' as const,
        label: '工作经验',
        icon: 'mdi:briefcase-clock',
        disabled: hasType('workYears'),
      },
      {
        type: 'position' as const,
        label: '求职意向',
        icon: 'mdi:target',
        disabled: hasType('position'),
      },
      {
        type: 'city' as const,
        label: '目标城市',
        icon: 'mdi:map-marker',
        disabled: hasType('city'),
      },
      {
        type: 'salary' as const,
        label: '期望薪资',
        icon: 'mdi:currency-cny',
        disabled: hasType('salary'),
      },
      { type: 'custom' as const, label: '自定义', icon: 'mdi:pencil', disabled: false },
    ]
  }

  /**
   * 删除求职意向项
   */
  const removeItem = (id: string) => {
    const updatedItems = items
      .filter((item) => item.id !== id)
      .map((item, index) => ({
        ...item,
        order: index,
      }))
    onUpdate({
      items: updatedItems,
      enabled,
    })
  }

  return (
    <Card className="section-card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:briefcase-search" className="text-primary h-5 w-5" />
          <h2 className="section-title">求职意向</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="job-intention-enabled" className="cursor-pointer text-sm">
              启用
            </Label>
            <Switch id="job-intention-enabled" checked={enabled} onCheckedChange={toggleEnabled} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={items.length >= 6 || isAddingItem}
                className="gap-2 bg-transparent"
              >
                <Icon icon="mdi:plus" className="h-4 w-4" />
                添加 ({items.length}/6)
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {getAvailableTypes().map((typeOption) => (
                <DropdownMenuItem
                  key={typeOption.type}
                  onClick={() => !typeOption.disabled && addItem(typeOption.type)}
                  disabled={typeOption.disabled || isAddingItem}
                  className="cursor-pointer gap-2"
                >
                  <Icon icon={typeOption.icon} className="h-4 w-4" />
                  <span>{typeOption.label}</span>
                  {typeOption.disabled && (
                    <span className="text-muted-foreground ml-auto text-xs">已添加</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4">
        {/* 求职意向项列表 */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sortedItems.map((item) => (
                <SortableJobIntentionItem
                  key={item.id}
                  item={item}
                  onUpdate={(updates) => updateItem(item.id, updates)}
                  onRemove={() => removeItem(item.id)}
                  disabled={!enabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {items.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <Icon icon="mdi:information-outline" className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">暂无求职意向信息，点击"添加"开始编辑</p>
          </div>
        )}
      </div>
    </Card>
  )
}

interface SortableJobIntentionItemProps {
  item: JobIntentionItem
  onUpdate: (updates: Partial<JobIntentionItem>) => void
  onRemove: () => void
  disabled: boolean
}

function SortableJobIntentionItem({
  item,
  onUpdate,
  onRemove,
  disabled,
}: SortableJobIntentionItemProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <JobIntentionItemEditor
        item={item}
        onUpdate={onUpdate}
        onRemove={onRemove}
        dragHandleProps={disabled ? null : { attributes, listeners }}
        isDragging={isDragging}
        disabled={disabled}
      />
    </div>
  )
}

/**
 * 求职意向项编辑器
 */
interface JobIntentionItemEditorProps {
  item: JobIntentionItem
  onUpdate: (updates: Partial<JobIntentionItem>) => void
  onRemove: () => void
  dragHandleProps?: SortableHandleProps | null
  isDragging?: boolean
  disabled?: boolean
}

function JobIntentionItemEditor({
  item,
  onUpdate,
  onRemove,
  dragHandleProps,
  isDragging,
  disabled,
}: JobIntentionItemEditorProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [salaryError, setSalaryError] = useState<string>('')

  const getIcon = () => {
    const icons = {
      workYears: 'mdi:briefcase-clock',
      position: 'mdi:target',
      city: 'mdi:map-marker',
      salary: 'mdi:currency-cny',
      custom: 'mdi:pencil',
    }
    return icons[item.type]
  }

  const handleSalaryChange = (field: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : parseInt(value)

    if (numValue !== undefined && (isNaN(numValue) || numValue <= 0)) {
      setSalaryError('请输入正整数')
      // 不更新值，阻止保存错误数据
      return
    }

    const newRange = {
      ...item.salaryRange,
      [field]: numValue,
    }

    // 验证 min <= max
    if (newRange.min !== undefined && newRange.max !== undefined && newRange.min > newRange.max) {
      setSalaryError('最小值不能大于最大值')
      // 仍然更新值，但显示错误提示
      onUpdate({
        salaryRange: newRange,
        value: formatSalaryValue(newRange),
      })
      return
    }

    setSalaryError('')
    onUpdate({
      salaryRange: newRange,
      value: formatSalaryValue(newRange),
    })
  }

  const formatSalaryValue = (range: { min?: number; max?: number }) => {
    if (range.min !== undefined && range.max !== undefined) {
      return `${range.min}K - ${range.max}K`
    } else if (range.min !== undefined) {
      return `${range.min}K 起`
    } else if (range.max !== undefined) {
      return `${range.max}K 以下`
    }
    return ''
  }

  const handleWorkYearsChange = (value: string) => {
    const numValue = value === '' ? '' : parseInt(value)

    if (numValue !== '' && (isNaN(numValue) || numValue < 0 || numValue > 100)) {
      return
    }

    onUpdate({
      value: numValue === '' ? '' : `${numValue}年`,
    })
  }

  return (
    <div className={`rounded-lg border p-2 ${disabled ? 'bg-muted/50 opacity-60' : 'bg-muted/30'}`}>
      <div className="flex items-start gap-2">
        {/* 图标 */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
          <Icon icon={getIcon()} className="text-muted-foreground h-5 w-5" />
        </div>

        {/* 标签 */}
        <div className="max-w-[120px] min-w-[80px] flex-[0_0_auto] pt-0">
          <Input
            value={item.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="标签"
            disabled={disabled || item.type !== 'custom'}
            className="h-8 text-sm placeholder:text-gray-400"
          />
        </div>

        {/* 值输入 - 根据类型不同显示不同的输入框 */}
        <div className="min-w-0 flex-1">
          {item.type === 'workYears' ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={item.value.replace('年', '')}
                onChange={(e) => handleWorkYearsChange(e.target.value)}
                placeholder="如：3"
                disabled={disabled}
                className="h-8 w-full text-sm placeholder:text-gray-400"
              />
              <span className="text-muted-foreground text-sm whitespace-nowrap">年</span>
            </div>
          ) : item.type === 'salary' ? (
            <div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  value={item.salaryRange?.min ?? ''}
                  onChange={(e) => handleSalaryChange('min', e.target.value)}
                  placeholder="6"
                  disabled={disabled}
                  className={`h-8 w-full text-sm placeholder:text-gray-400 ${salaryError ? 'border-destructive' : ''}`}
                />
                <span className="text-muted-foreground text-sm">K</span>
                <span className="text-muted-foreground text-sm">-</span>
                <Input
                  type="number"
                  min={1}
                  value={item.salaryRange?.max ?? ''}
                  onChange={(e) => handleSalaryChange('max', e.target.value)}
                  placeholder="8"
                  disabled={disabled}
                  className={`h-8 w-full text-sm placeholder:text-gray-400 ${salaryError ? 'border-destructive' : ''}`}
                />
                <span className="text-muted-foreground text-sm">K</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon
                        icon="mdi:information-outline"
                        className="text-muted-foreground h-4 w-4 flex-shrink-0 cursor-help"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>K = 1000元</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {salaryError && <p className="text-destructive mt-1 text-xs">{salaryError}</p>}
            </div>
          ) : (
            <Input
              value={item.value}
              onChange={(e) => onUpdate({ value: e.target.value })}
              placeholder={
                item.type === 'position'
                  ? '如：Java开发工程师'
                  : item.type === 'city'
                    ? '如：北京'
                    : '内容'
              }
              disabled={disabled}
              className="h-8 w-full text-sm placeholder:text-gray-400"
            />
          )}
        </div>

        {/* 删除按钮和拖拽手柄组 */}
        <div className="flex flex-[0_0_auto] items-center gap-1 pt-0">
          {/* 删除按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={disabled}
            aria-label="删除"
            className="icon-button text-destructive hover:text-destructive h-8 w-8 flex-shrink-0 p-0"
          >
            <Icon icon="mdi:delete" className="h-4 w-4" />
          </Button>

          {/* 拖拽手柄 */}
          <button
            type="button"
            {...(dragHandleProps?.attributes ?? {})}
            {...(dragHandleProps?.listeners ?? {})}
            aria-label="拖拽排序"
            disabled={disabled}
            className={`text-muted-foreground hover:text-foreground flex h-8 w-8 flex-shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing ${isDragging ? 'text-foreground' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <Icon icon="mdi:drag" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除这个求职意向项吗？此操作无法撤销。
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
    </div>
  )
}
