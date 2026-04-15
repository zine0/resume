import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import type { PersonalInfoItem, PersonalInfoSection, PersonalInfoLayout } from '@/types/resume'
import { createPersonalInfoItem } from '@/lib/storage'
import { useToast } from '@/hooks/use-toast'
import IconPicker from './icon-picker'

interface PersonalInfoEditorProps {
  personalInfoSection: PersonalInfoSection
  avatar?: string
  onUpdate: (personalInfoSection: PersonalInfoSection, avatar?: string) => void
}

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>

function buildInlineSvgDataUrl(icon?: string) {
  if (!icon) return ''
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${icon}</svg>`)}`
}

/**
 * 个人信息编辑器组件
 */
export default function PersonalInfoEditor({
  personalInfoSection,
  avatar,
  onUpdate,
}: PersonalInfoEditorProps) {
  const { toast } = useToast()
  const [isAddingItem, setIsAddingItem] = useState(false)
  const avatarUrl = avatar || ''
  const showLabels = personalInfoSection?.showPersonalInfoLabels !== false
  const layout: PersonalInfoLayout = personalInfoSection?.layout ?? { mode: 'grid', itemsPerRow: 2 }
  const avatarType = personalInfoSection?.avatarType === 'idPhoto' ? 'idPhoto' : 'default'
  const isIdPhoto = avatarType === 'idPhoto'
  const avatarShape = isIdPhoto
    ? 'square'
    : personalInfoSection?.avatarShape === 'square'
      ? 'square'
      : 'circle'
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 提取personalInfo到局部变量以简化代码，如果personalInfoSection不存在则使用空数组
  const personalInfo = personalInfoSection?.personalInfo || []
  const sortedPersonalInfo = [...personalInfo].sort((a, b) => a.order - b.order)

  /**
   * 处理拖拽排序结束事件
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const sourceIndex = sortedPersonalInfo.findIndex((item) => item.id === active.id)
    const destinationIndex = sortedPersonalInfo.findIndex((item) => item.id === over.id)

    if (sourceIndex < 0 || destinationIndex < 0 || sourceIndex === destinationIndex) return

    const reorderedPersonalInfo = arrayMove(sortedPersonalInfo, sourceIndex, destinationIndex)

    // 更新order字段
    const updatedPersonalInfo = reorderedPersonalInfo.map((item, index) => ({
      ...item,
      order: index,
    }))

    onUpdate(
      {
        ...personalInfoSection,
        personalInfo: updatedPersonalInfo,
      },
      avatarUrl,
    )
  }

  /**
   * 切换标签显示
   */
  const toggleShowLabels = () => {
    if (!personalInfoSection) return
    const newShowLabels = !showLabels
    onUpdate({
      ...personalInfoSection,
      showPersonalInfoLabels: newShowLabels,
    })
  }

  /**
   * 切换布局模式
   */
  const toggleLayoutMode = () => {
    if (!personalInfoSection) return
    const newMode = layout.mode === 'inline' ? 'grid' : 'inline'
    const newLayout: PersonalInfoLayout = { ...layout, mode: newMode as 'inline' | 'grid' }
    onUpdate({
      ...personalInfoSection,
      layout: newLayout,
    })
  }

  /**
   * 切换头像显示风格（圆形 / 方形）
   */
  const toggleAvatarShape = () => {
    if (!personalInfoSection || isIdPhoto) return
    const newShape = avatarShape === 'circle' ? 'square' : 'circle'
    onUpdate({
      ...personalInfoSection,
      avatarShape: newShape,
    })
  }

  const handleAvatarTypeChange = (value: 'default' | 'idPhoto') => {
    if (!personalInfoSection) return
    const nextShape =
      value === 'idPhoto'
        ? 'square'
        : personalInfoSection.avatarShape === 'square'
          ? 'square'
          : 'circle'
    onUpdate({
      ...personalInfoSection,
      avatarType: value,
      avatarShape: nextShape,
    })
  }

  /**
   * 设置每行列数
   */
  const handleItemsPerRowChange = (itemsPerRow: 1 | 2 | 3 | 4 | 5 | 6) => {
    if (!personalInfoSection) return
    const newLayout: PersonalInfoLayout = {
      ...layout,
      mode: 'grid',
      itemsPerRow,
    }
    onUpdate({
      ...personalInfoSection,
      layout: newLayout,
    })
  }

  useEffect(() => {
    if (!avatar) return
    // avatarUrl is derived from props; no local setState
  }, [avatar])

  useEffect(() => {
    // 同步 personalInfoSection 的变化，更新本地状态
    if (personalInfoSection) {
      // showLabels derived from props

      // 更新layout状态
      if (personalInfoSection.layout) {
        // layout derived from props
      }
    }
  }, [personalInfoSection])

  /**
   * 处理文件上传
   */
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!personalInfoSection) return
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        onUpdate(
          {
            ...personalInfoSection,
            personalInfo: personalInfo,
          },
          base64,
        )
      }
      reader.readAsDataURL(file)
    }
  }

  /**
   * 更新个人信息项
   */
  const updatePersonalInfoItem = (id: string, updates: Partial<PersonalInfoItem>) => {
    if (!personalInfoSection) return
    const updatedInfo = personalInfo.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    )
    onUpdate(
      {
        ...personalInfoSection,
        personalInfo: updatedInfo,
      },
      avatarUrl,
    )
  }

  /**
   * 添加新的个人信息项
   */
  const addPersonalInfoItem = async () => {
    if (!personalInfoSection || isAddingItem) return
    try {
      setIsAddingItem(true)
      const nextOrder = personalInfo.reduce((max, item) => Math.max(max, item.order), -1) + 1
      const newItem = await createPersonalInfoItem(nextOrder)
      onUpdate(
        {
          ...personalInfoSection,
          personalInfo: [...personalInfo, newItem],
        },
        avatarUrl,
      )
    } catch (e) {
      toast({
        title: '添加失败',
        description: e instanceof Error ? e.message : '无法创建新的个人信息项',
        variant: 'destructive',
      })
    } finally {
      setIsAddingItem(false)
    }
  }

  /**
   * 删除个人信息项
   */
  const removePersonalInfoItem = (id: string) => {
    if (!personalInfoSection) return
    const updatedInfo = personalInfo
      .filter((item) => item.id !== id)
      .map((item, index) => ({
        ...item,
        order: index,
      }))

    // 如果删除后，当前列数大于剩余项目数，自动调整列数
    const maxCols = Math.max(Math.min(6, updatedInfo.length), 1)
    const currentCols = layout.itemsPerRow || 2
    let newLayout = { ...layout }

    if (currentCols > maxCols) {
      newLayout = {
        ...layout,
        itemsPerRow: maxCols as 1 | 2 | 3 | 4 | 5 | 6,
      }
    }

    onUpdate(
      {
        ...personalInfoSection,
        personalInfo: updatedInfo,
        layout: newLayout,
      },
      avatarUrl,
    )
  }

  /**
   * 处理头像URL变化
   */
  const handleAvatarChange = (url: string) => {
    if (!personalInfoSection) return
    onUpdate(personalInfoSection, url)
  }

  return (
    <Card className="section-card">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:account-circle" className="text-primary h-5 w-5" />
          <h2 className="section-title">个人信息</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={avatarType}
            onValueChange={(value) => handleAvatarTypeChange(value as 'default' | 'idPhoto')}
          >
            <SelectTrigger className="h-9 w-28">
              <SelectValue placeholder="头像类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">普通头像</SelectItem>
              <SelectItem value="idPhoto">一寸照片</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleAvatarShape}
            className="gap-2 bg-transparent"
            disabled={isIdPhoto}
          >
            <Icon
              icon={
                avatarShape === 'circle'
                  ? 'mdi:checkbox-blank-circle-outline'
                  : 'mdi:checkbox-blank-outline'
              }
              className="h-4 w-4"
            />
            {avatarShape === 'circle' ? '圆形头像' : '方形头像'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleLayoutMode}
            className="gap-2 bg-transparent"
          >
            <Icon
              icon={layout.mode === 'inline' ? 'mdi:view-column' : 'mdi:view-sequential'}
              className="h-4 w-4"
            />
            {layout.mode === 'inline' ? '单行显示' : '多行显示'}
          </Button>

          {/* 每行列数选择器 - 只在grid模式下显示 */}
          {layout.mode === 'grid' && (
            <>
              <Select
                value={String(layout.itemsPerRow || 2)}
                onValueChange={(value) =>
                  handleItemsPerRowChange(Number(value) as 1 | 2 | 3 | 4 | 5 | 6)
                }
              >
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((num) => {
                    const maxCols = Math.max(Math.min(6, personalInfo.length), 1)
                    if (num > maxCols) return null
                    return (
                      <SelectItem key={num} value={String(num)}>
                        {num}列
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={toggleShowLabels}
            className="gap-2 bg-transparent"
          >
            <Icon icon={showLabels ? 'mdi:eye-off' : 'mdi:eye'} className="h-4 w-4" />
            {showLabels ? '隐藏标签' : '显示标签'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={addPersonalInfoItem}
            disabled={isAddingItem}
            className="gap-2 bg-transparent"
          >
            <Icon icon="mdi:plus" className="h-4 w-4" />
            添加信息
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* 头像设置 */}
        <div className="form-group">
          <Label className="form-label">头像</Label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className={`border-border hover:border-primary flex h-16 w-16 items-center justify-center overflow-hidden border-2 border-dashed hover:cursor-pointer ${avatarShape === 'square' ? 'rounded-none' : 'rounded-full'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="头像预览" className="h-full w-full object-cover" />
              ) : (
                <Icon icon="mdi:account" className="text-muted-foreground h-8 w-8" />
              )}
            </button>
            <div className="flex-1">
              <Input
                value={avatarUrl}
                onChange={(e) => handleAvatarChange(e.target.value)}
                placeholder="请输入头像图片URL或点击头像上传"
                className="border-border mb-2 border placeholder:text-gray-400"
              />
              <p className="pl-3 text-xs text-gray-400">
                {isIdPhoto
                  ? '一寸照片模式：固定方形显示，不支持圆形头像。'
                  : '建议使用1:1比例的图片'}
              </p>
            </div>
          </div>
        </div>

        {/* 个人信息项列表 */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedPersonalInfo.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sortedPersonalInfo.map((item) => (
                <SortablePersonalInfoItem
                  key={item.id}
                  item={item}
                  onUpdate={(updates) => updatePersonalInfoItem(item.id, updates)}
                  onRemove={() => removePersonalInfoItem(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {personalInfo.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <Icon icon="mdi:information-outline" className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">暂无个人信息，点击“添加信息”开始编辑</p>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
    </Card>
  )
}

interface SortablePersonalInfoItemProps {
  item: PersonalInfoItem
  onUpdate: (updates: Partial<PersonalInfoItem>) => void
  onRemove: () => void
}

function SortablePersonalInfoItem({ item, onUpdate, onRemove }: SortablePersonalInfoItemProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex-1"
    >
      <PersonalInfoItemEditor
        item={item}
        onUpdate={onUpdate}
        onRemove={onRemove}
        dragHandleProps={{ attributes, listeners }}
        isDragging={isDragging}
      />
    </div>
  )
}

/**
 * 个人信息项编辑器
 */
interface PersonalInfoItemEditorProps {
  item: PersonalInfoItem
  onUpdate: (updates: Partial<PersonalInfoItem>) => void
  onRemove: () => void
  dragHandleProps?: SortableHandleProps | null
  isDragging?: boolean
}

function PersonalInfoItemEditor({
  item,
  onUpdate,
  onRemove,
  dragHandleProps,
  isDragging,
}: PersonalInfoItemEditorProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  return (
    <div className="bg-muted/30 flex items-start gap-2 rounded-lg border p-2">
      {/* 图标选择 */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="选择图标"
            className="icon-button-personal-info flex h-8 w-8 flex-shrink-0 items-center justify-center bg-transparent p-0"
          >
            {item.icon ? (
              <img src={buildInlineSvgDataUrl(item.icon)} alt="当前图标" className="h-4 w-4" />
            ) : null}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择图标</DialogTitle>
          </DialogHeader>
          <IconPicker selectedIcon={item.icon} onSelect={(icon) => onUpdate({ icon })} />
        </DialogContent>
      </Dialog>

      {/* 单行布局：标签 | 类型 | 值输入 | 删除 | 拖拽手柄 */}
      <div className="flex min-w-0 flex-1 items-end gap-2">
        {/* 标签 */}
        <div className="max-w-[120px] min-w-[80px] flex-[0_0_auto]">
          <div className="flex h-8 flex-col justify-end">
            <Input
              value={item.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="标签"
              className="h-8 text-sm placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* 类型选择 */}
        <div className="w-[60px] flex-[0_0_auto]">
          <div className="flex h-8 flex-col justify-end">
            <Select
              value={item.value.type || 'text'}
              onValueChange={(value: 'text' | 'link') =>
                onUpdate({ value: { ...item.value, type: value } })
              }
            >
              <SelectTrigger className="h-8 border-gray-200 px-2 py-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">文本</SelectItem>
                <SelectItem value="link">链接</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 值输入 */}
        <div className="min-w-0 flex-1">
          {item.value.type === 'link' ? (
            <div className="flex h-8 gap-1">
              <div className="flex h-8 min-w-0 flex-1 flex-col justify-end">
                <Input
                  value={item.value.content}
                  onChange={(e) => onUpdate({ value: { ...item.value, content: e.target.value } })}
                  placeholder="链接地址"
                  className="h-8 w-full text-sm placeholder:text-gray-400"
                />
              </div>
              <div className="flex h-8 min-w-0 flex-1 flex-col justify-end">
                <Input
                  value={item.value.title || ''}
                  onChange={(e) => onUpdate({ value: { ...item.value, title: e.target.value } })}
                  placeholder="显示标题"
                  className="h-8 w-full text-sm placeholder:text-gray-400"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-8 flex-col justify-end">
              <Input
                value={item.value.content}
                onChange={(e) => onUpdate({ value: { ...item.value, content: e.target.value } })}
                placeholder="内容"
                className="h-8 w-full text-sm placeholder:text-gray-400"
              />
            </div>
          )}
        </div>

        {/* 删除按钮和拖拽手柄组 */}
        <div className="flex flex-[0_0_auto] items-center gap-1">
          {/* 删除按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
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
            className={`text-muted-foreground hover:text-foreground flex h-8 w-8 flex-shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing ${isDragging ? 'text-foreground' : ''}`}
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
              您确定要删除这个个人信息项吗？此操作无法撤销。
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
