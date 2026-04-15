import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
// Avoid Radix Avatar/Checkbox to prevent extra deps; use basic elements
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
import { Badge } from '@/components/ui/badge'
import { Icon } from '@iconify/react'
import { useToast } from '@/hooks/use-toast'
import ResumePreview from '@/components/resume-preview'
import type { StoredResume } from '@/types/resume'
import {
  StorageError,
  createEntryFromData,
  deleteResumes,
  getAllResumes,
  getDefaultResumeData,
  importResumeFile,
  loadDefaultTemplate,
  loadExampleTemplate,
} from '@/lib/storage'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ExportButton from '@/components/export-button'
import { getResumeLineageHint, getResumeVariantLabel } from '@/lib/resume-lineage'

type SortKey = 'name' | 'createdAt' | 'updatedAt'
type SortDir = 'asc' | 'desc'

interface ResumeFamilyGroup {
  familyId: string
  items: StoredResume[]
}

interface ResumeInspectorMetadataItem {
  label: string
  value: string
}

interface ResumeCompareSummary {
  leftLabel: string
  leftTitle: string
  leftVariantLabel: string
  rightLabel: string
  rightTitle: string
  rightVariantLabel: string
  newerSide: 'left' | 'right' | 'same'
  moduleDelta: number
  sharedModuleTitles: string[]
  leftOnlyModuleTitles: string[]
  rightOnlyModuleTitles: string[]
  personalInfoDelta: number
  avatarChanged: boolean
  jobIntentionChanged: boolean
}

type ResumeInspectorState =
  | { mode: 'detail'; resumeId: string }
  | {
      mode: 'compare'
      familyId: string
      leftId: string
      rightId: string
      leftLabel: string
      rightLabel: string
    }

function getFamilyId(item: StoredResume): string {
  return item.lineage.familyId || item.id
}

function formatInspectorTime(value: string): string {
  return new Date(value).toLocaleString()
}

function getResumeTitle(resume: StoredResume): string {
  return resume.resumeData.title || '未命名简历'
}

function getPersonalInfoCount(resume: StoredResume): number {
  return resume.resumeData.personalInfoSection?.personalInfo.length ?? 0
}

function getHasAvatar(resume: StoredResume): boolean {
  return Boolean(resume.resumeData.avatar?.trim())
}

function getHasJobIntention(resume: StoredResume): boolean {
  const section = resume.resumeData.jobIntentionSection

  if (!section?.enabled) {
    return false
  }

  return section.items.some((item) => {
    const hasValue = Boolean(item.value.trim())
    const hasSalaryRange = Boolean(item.salaryRange?.min || item.salaryRange?.max)
    return hasValue || hasSalaryRange
  })
}

function getModuleTitles(resume: StoredResume): string[] {
  return resume.resumeData.modules
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((module) => module.title.trim() || '未命名模块')
}

function getModuleTitleCounts(titles: string[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const title of titles) {
    counts.set(title, (counts.get(title) ?? 0) + 1)
  }

  return counts
}

function formatModuleTitleBadges(counts: Map<string, number>): string[] {
  return Array.from(counts.entries()).map(([title, count]) =>
    count > 1 ? `${title} ×${count}` : title,
  )
}

function getJobIntentionSignature(resume: StoredResume): string {
  const section = resume.resumeData.jobIntentionSection

  if (!section?.enabled) {
    return 'none'
  }

  const itemSignature = section.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const salaryRange = item.salaryRange
        ? `${item.salaryRange.min ?? ''}-${item.salaryRange.max ?? ''}`
        : ''
      return [item.type, item.label, item.value.trim(), salaryRange].join(':')
    })
    .filter((signature) => signature.replace(/[:|]/g, '').trim().length > 0)
    .join('|')

  return itemSignature || 'none'
}

function getDetailMetadata(resume: StoredResume): ResumeInspectorMetadataItem[] {
  return [
    { label: '标题', value: getResumeTitle(resume) },
    { label: '变体', value: getResumeVariantLabel(resume.lineage.variantKind) },
    { label: '家族 ID（前 8 位）', value: getFamilyId(resume).slice(0, 8) },
    { label: '谱系提示', value: getResumeLineageHint(resume.lineage) ?? '无额外提示' },
    { label: '创建时间', value: formatInspectorTime(resume.createdAt) },
    { label: '更新时间', value: formatInspectorTime(resume.updatedAt) },
    { label: '模块数', value: `${resume.resumeData.modules.length}` },
    { label: '个人信息项', value: `${getPersonalInfoCount(resume)}` },
    { label: '求职意向', value: getHasJobIntention(resume) ? '有' : '无' },
    { label: '头像', value: getHasAvatar(resume) ? '有' : '无' },
  ]
}

function getCompareSummary(
  left: StoredResume,
  right: StoredResume,
  leftLabel: string,
  rightLabel: string,
): ResumeCompareSummary {
  const leftTitles = getModuleTitles(left)
  const rightTitles = getModuleTitles(right)
  const leftTitleCounts = getModuleTitleCounts(leftTitles)
  const rightTitleCounts = getModuleTitleCounts(rightTitles)
  const leftUpdatedAt = new Date(left.updatedAt).getTime()
  const rightUpdatedAt = new Date(right.updatedAt).getTime()
  const sharedCounts = new Map<string, number>()
  const leftOnlyCounts = new Map<string, number>()
  const rightOnlyCounts = new Map<string, number>()

  for (const [title, leftCount] of leftTitleCounts.entries()) {
    const rightCount = rightTitleCounts.get(title) ?? 0
    const sharedCount = Math.min(leftCount, rightCount)

    if (sharedCount > 0) {
      sharedCounts.set(title, sharedCount)
    }

    if (leftCount > sharedCount) {
      leftOnlyCounts.set(title, leftCount - sharedCount)
    }
  }

  for (const [title, rightCount] of rightTitleCounts.entries()) {
    const leftCount = leftTitleCounts.get(title) ?? 0
    const sharedCount = Math.min(leftCount, rightCount)

    if (rightCount > sharedCount) {
      rightOnlyCounts.set(title, rightCount - sharedCount)
    }
  }

  return {
    leftLabel,
    leftTitle: getResumeTitle(left),
    leftVariantLabel: getResumeVariantLabel(left.lineage.variantKind),
    rightLabel,
    rightTitle: getResumeTitle(right),
    rightVariantLabel: getResumeVariantLabel(right.lineage.variantKind),
    newerSide:
      leftUpdatedAt === rightUpdatedAt ? 'same' : leftUpdatedAt > rightUpdatedAt ? 'left' : 'right',
    moduleDelta: right.resumeData.modules.length - left.resumeData.modules.length,
    sharedModuleTitles: formatModuleTitleBadges(sharedCounts),
    leftOnlyModuleTitles: formatModuleTitleBadges(leftOnlyCounts),
    rightOnlyModuleTitles: formatModuleTitleBadges(rightOnlyCounts),
    personalInfoDelta: getPersonalInfoCount(right) - getPersonalInfoCount(left),
    avatarChanged:
      (left.resumeData.avatar?.trim() ?? '') !== (right.resumeData.avatar?.trim() ?? ''),
    jobIntentionChanged: getJobIntentionSignature(left) !== getJobIntentionSignature(right),
  }
}

export default function UserCenter() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [items, setItems] = useState<StoredResume[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [inspector, setInspector] = useState<ResumeInspectorState | null>(null)

  const refresh = useCallback(async () => {
    try {
      setItems(await getAllResumes())
    } catch (e) {
      toast({ title: '读取失败', description: e instanceof Error ? e.message : '无法读取本地存储' })
    }
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  // 轻量预取新建/示例模板，提升后续进入编辑页的首屏速度
  useEffect(() => {
    // 忽略结果，仅触发浏览器缓存
    loadDefaultTemplate()
    loadExampleTemplate()
  }, [])

  const filteredSorted = useMemo(() => {
    const list = items.filter(
      (it) =>
        !keyword.trim() || it.resumeData.title.toLowerCase().includes(keyword.trim().toLowerCase()),
    )
    const sorted = [...list].sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortKey === 'name') {
        va = a.resumeData.title || ''
        vb = b.resumeData.title || ''
        return sortDir === 'asc'
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va))
      }
      if (sortKey === 'createdAt') {
        va = new Date(a.createdAt).getTime()
        vb = new Date(b.createdAt).getTime()
      } else {
        va = new Date(a.updatedAt).getTime()
        vb = new Date(b.updatedAt).getTime()
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
    return sorted
  }, [items, keyword, sortKey, sortDir])

  const groupedFamilies = useMemo<ResumeFamilyGroup[]>(() => {
    const groups = new Map<string, ResumeFamilyGroup>()

    for (const item of filteredSorted) {
      const familyId = getFamilyId(item)
      const current = groups.get(familyId)

      if (current) {
        current.items.push(item)
      } else {
        groups.set(familyId, { familyId, items: [item] })
      }
    }

    return Array.from(groups.values())
  }, [filteredSorted])

  const familySizes = useMemo(() => {
    const sizes = new Map<string, number>()

    for (const item of items) {
      const familyId = getFamilyId(item)
      sizes.set(familyId, (sizes.get(familyId) ?? 0) + 1)
    }

    return sizes
  }, [items])

  const visibleIds = useMemo(() => filteredSorted.map((item) => item.id), [filteredSorted])
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const familyItemsMap = useMemo(() => {
    const map = new Map<string, StoredResume[]>()

    for (const item of items) {
      const familyId = getFamilyId(item)
      const current = map.get(familyId)

      if (current) {
        current.push(item)
      } else {
        map.set(familyId, [item])
      }
    }

    for (const familyItems of map.values()) {
      familyItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return map
  }, [items])
  const visibleSelectedIds = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [selected, visibleIds],
  )
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const inspectorDetailResume =
    inspector?.mode === 'detail' ? (itemMap.get(inspector.resumeId) ?? null) : null
  const inspectorCompareResumes =
    inspector?.mode === 'compare'
      ? {
          left: itemMap.get(inspector.leftId) ?? null,
          right: itemMap.get(inspector.rightId) ?? null,
        }
      : null
  const inspectorDetailMetadata = useMemo(
    () => (inspectorDetailResume ? getDetailMetadata(inspectorDetailResume) : null),
    [inspectorDetailResume],
  )
  const inspectorCompareSummary = useMemo(() => {
    if (!inspectorCompareResumes?.left || !inspectorCompareResumes.right) {
      return null
    }

    if (inspector?.mode !== 'compare') {
      return null
    }

    return getCompareSummary(
      inspectorCompareResumes.left,
      inspectorCompareResumes.right,
      inspector.leftLabel,
      inspector.rightLabel,
    )
  }, [inspector, inspectorCompareResumes])

  const SortArrows = ({ field }: { field: SortKey }) => {
    const activeAsc = sortKey === field && sortDir === 'asc'
    const activeDesc = sortKey === field && sortDir === 'desc'
    return (
      <span className="ml-1 inline-flex flex-col items-center justify-center rounded border px-0.5 py-px text-[10px] leading-none">
        <Icon
          icon="mdi:triangle"
          className={`h-2.5 w-2.5 cursor-pointer ${activeAsc ? 'text-blue-500' : 'text-muted-foreground/50'}`}
          onClick={() => {
            setSortKey(field)
            setSortDir('asc')
          }}
        />
        <Icon
          icon="mdi:triangle-down"
          className={`h-2.5 w-2.5 cursor-pointer ${activeDesc ? 'text-blue-500' : 'text-muted-foreground/50'}`}
          onClick={() => {
            setSortKey(field)
            setSortDir('desc')
          }}
        />
      </span>
    )
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)

      for (const id of visibleIds) {
        if (checked) next.add(id)
        else next.delete(id)
      }

      return next
    })
  }

  // 将初始化数据预加载并写入 sessionStorage，然后再跳转，避免在新页面内数据“闪变”
  const prefetchAndOpenNew = async (type: 'default' | 'example') => {
    try {
      const tpl = type === 'example' ? await loadExampleTemplate() : await loadDefaultTemplate()
      const data = tpl ?? (await getDefaultResumeData())
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('new-edit-initial-data', JSON.stringify(data))
        } catch {
          // sessionStorage may be unavailable
        }
      }
    } finally {
      navigate(`/edit/new`)
    }
  }

  const handleCreate = () => {
    void prefetchAndOpenNew('default')
  }

  const handleClone = (id: string) => {
    // 不立即保存，带上 cloneId 进入新建编辑页
    navigate(`/edit/new?clone=${encodeURIComponent(id)}`)
  }

  const handleImport: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      if (!file.name.endsWith('.json')) {
        toast({
          title: '文件格式错误',
          description: '请选择 .json 格式的文件',
          variant: 'destructive',
        })
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: '文件过大', description: '文件大小不能超过 5MB', variant: 'destructive' })
        return
      }
      setImporting(true)
      const content = await file.text()
      const data = await importResumeFile(content)
      const entry = await createEntryFromData(data)
      toast({ title: '导入成功', description: `已导入：${entry.resumeData.title}` })
      refresh()
      // Do not auto-navigate; user can choose next action
    } catch (e: unknown) {
      if (e instanceof StorageError && e.code === 'QUOTA_EXCEEDED') {
        toast({
          title: '存储空间不足',
          description: '请删除旧简历或先导出为 JSON 后再清理。',
          variant: 'destructive',
        })
      } else {
        const message = e instanceof Error ? e.message : '文件解析或保存失败'
        toast({ title: '导入失败', description: message, variant: 'destructive' })
      }
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  const handleDelete = async (ids: string[]) => {
    try {
      await deleteResumes(ids)
      toast({ title: '删除成功', description: `已删除 ${ids.length} 条简历` })
      setSelected(new Set())
      refresh()
    } catch (e) {
      toast({
        title: '删除失败',
        description: e instanceof Error ? e.message : '未知错误',
        variant: 'destructive',
      })
    }
  }

  const openDetailInspector = (resumeId: string) => {
    setInspector({ mode: 'detail', resumeId })
  }

  const openCompareInspector = (
    familyId: string,
    leftId: string,
    rightId: string,
    labels: { left: string; right: string },
  ) => {
    if (leftId === rightId) {
      toast({ title: '无法对比', description: '请至少选择同家族中的两个不同版本。' })
      return
    }

    setInspector({
      mode: 'compare',
      familyId,
      leftId,
      rightId,
      leftLabel: labels.left,
      rightLabel: labels.right,
    })
  }

  const handleCompareWithLatest = (resume: StoredResume) => {
    const familyId = getFamilyId(resume)
    const familyItems = familyItemsMap.get(familyId) ?? []

    if (familyItems.length < 2) {
      toast({ title: '暂无可对比版本', description: '该版本家族当前只有一份简历。' })
      return
    }

    const latest = familyItems[0]
    const fallback = familyItems[1]
    const target = latest.id === resume.id ? fallback : latest

    if (!target) {
      toast({ title: '无法对比', description: '未找到适合的对比版本，请稍后重试。' })
      return
    }

    openCompareInspector(familyId, resume.id, target.id, {
      left: '当前选择',
      right: latest.id === resume.id ? '上一版' : '最新版本',
    })
  }

  const handleCompareLatestTwo = (familyId: string) => {
    const familyItems = familyItemsMap.get(familyId) ?? []

    if (familyItems.length < 2) {
      toast({ title: '暂无可对比版本', description: '该版本家族当前只有一份简历。' })
      return
    }

    openCompareInspector(familyId, familyItems[1].id, familyItems[0].id, {
      left: '较早版本',
      right: '较新版本',
    })
  }

  const closeInspector = (open: boolean) => {
    if (!open) setInspector(null)
  }

  const renderPreviewPanel = (
    resume: StoredResume,
    label: string,
    align: 'left' | 'right' = 'left',
  ) => (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="bg-muted/40 rounded-lg border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{label}</Badge>
          <span className="text-sm font-medium">{resume.resumeData.title || '未命名简历'}</span>
          <Badge variant="outline">{getResumeVariantLabel(resume.lineage.variantKind)}</Badge>
        </div>
        <div
          className={`text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${align === 'right' ? 'xl:justify-end' : ''}`}
        >
          <span>更新时间：{new Date(resume.updatedAt).toLocaleString()}</span>
          <span>家族：{getFamilyId(resume).slice(0, 8)}</span>
          {getResumeLineageHint(resume.lineage) ? (
            <span>{getResumeLineageHint(resume.lineage)}</span>
          ) : null}
        </div>
      </div>
      <div className="bg-muted/20 overflow-x-auto rounded-xl border p-3">
        <div className="mx-auto w-[210mm] max-w-full bg-white shadow-sm">
          <ResumePreview
            resumeData={resume.resumeData}
            emptyStateMessage="当前版本暂无模块内容。"
          />
        </div>
      </div>
    </div>
  )

  const renderCompareModuleList = (
    label: string,
    titles: string[],
    badgeVariant: 'secondary' | 'outline' = 'outline',
  ) => (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex min-h-8 flex-wrap gap-1.5">
        {titles.length > 0 ? (
          titles.map((title) => (
            <Badge key={`${label}-${title}`} variant={badgeVariant}>
              {title}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">无</span>
        )}
      </div>
    </div>
  )

  return (
    <div className="bg-background min-h-screen">
      {/* 统一隐藏文件输入，空态也可使用 */}
      <input
        id="uc-import-file"
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <Icon icon="mdi:account" className="text-primary h-6 w-6" />
          <h1 className="text-lg font-semibold">我的简历</h1>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2 bg-transparent" onClick={() => navigate('/')}>
            <Icon icon="mdi:view-kanban-outline" className="h-4 w-4" /> 回到求职看板
          </Button>
          {items.length > 0 && (
            <>
              <Input
                placeholder="搜索简历名称"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-56"
              />
              {null}
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="default"
                className="gap-2"
                onClick={() => document.getElementById('uc-import-file')?.click()}
                disabled={importing}
              >
                <Icon icon="mdi:import" className="h-4 w-4" /> 导入
              </Button>
              <Button onClick={handleCreate} className="gap-2">
                <Icon icon="mdi:plus" className="h-4 w-4" /> 创建简历
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={visibleSelectedIds.length === 0}
                onClick={() => setConfirmOpen(true)}
              >
                <Icon icon="mdi:trash-can" className="h-4 w-4" /> 批量删除
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* 列表（表格） */}
      <div className="space-y-3 p-4">
        {filteredSorted.length > 0 && (
          <div className="flex items-center gap-3 px-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border"
              checked={allVisibleSelected}
              onChange={(e) => toggleSelectAll(e.target.checked)}
            />
            <span className="text-muted-foreground text-sm">
              当前结果中已选 {visibleSelectedIds.length} 项
            </span>
          </div>
        )}
        {filteredSorted.length === 0 ? (
          <div className="py-16">
            <div className="bg-muted/30 mx-auto max-w-xl rounded-xl border p-10 text-center shadow-sm">
              <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Icon icon="mdi:file-document-edit" className="text-primary h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">
                {items.length === 0 ? '暂无简历' : '未找到匹配的简历'}
              </h3>
              <div className="mt-2 inline-flex flex-col items-stretch">
                <p className="text-muted-foreground text-sm">
                  {items.length === 0
                    ? '点击“创建简历”开始，或从 JSON 文件导入已有数据并继续编辑'
                    : '请尝试调整搜索关键词，或清空筛选后查看全部简历'}
                </p>
                <div className="mt-6 flex items-center justify-between">
                  {items.length === 0 ? (
                    <>
                      <Button onClick={handleCreate} className="shrink-0 gap-2">
                        <Icon icon="mdi:plus" className="h-4 w-4" /> 创建简历
                      </Button>
                      <Button
                        variant="outline"
                        className="shrink-0 gap-2"
                        onClick={() => document.getElementById('uc-import-file')?.click()}
                        disabled={importing}
                      >
                        <Icon icon="mdi:import" className="h-4 w-4" /> 导入
                      </Button>
                      <Button
                        variant="outline"
                        className="shrink-0 gap-2"
                        onClick={() => navigate('/')}
                      >
                        <Icon icon="mdi:view-kanban-outline" className="h-4 w-4" /> 求职看板
                      </Button>
                      <Button
                        variant="outline"
                        className="shrink-0 gap-2"
                        onClick={() => prefetchAndOpenNew('example')}
                      >
                        <Icon icon="mdi:lightbulb-on" className="h-4 w-4" /> 示例
                      </Button>
                      <Button
                        variant="outline"
                        className="shrink-0 gap-2"
                        onClick={() =>
                          window.open(
                            'https://github.com/wzdnzd/resume',
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        <Icon icon="mdi:github" className="h-4 w-4" /> GitHub
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="shrink-0 gap-2"
                        onClick={() => setKeyword('')}
                      >
                        <Icon icon="mdi:close-circle-outline" className="h-4 w-4" /> 清空搜索
                      </Button>
                      <Button
                        variant="outline"
                        className="shrink-0 gap-2"
                        onClick={() => navigate('/')}
                      >
                        <Icon icon="mdi:view-kanban-outline" className="h-4 w-4" /> 求职看板
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-center">编号</TableHead>
                <TableHead className="text-center">头像</TableHead>
                <TableHead>
                  <div className="flex items-center justify-start">
                    名称 <SortArrows field="name" />
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center">
                    创建时间 <SortArrows field="createdAt" />
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center">
                    更新时间 <SortArrows field="updatedAt" />
                  </div>
                </TableHead>
                <TableHead className="w-[360px] text-center">
                  <div className="flex items-center justify-center">操作</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedFamilies.map((group) => (
                <Fragment key={group.familyId}>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={7} className="py-2">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">家族</Badge>
                          <span className="font-medium">{group.familyId.slice(0, 8)}</span>
                          <span className="text-muted-foreground">
                            {(() => {
                              const totalCount =
                                familySizes.get(group.familyId) ?? group.items.length
                              return totalCount === group.items.length
                                ? `共 ${totalCount} 份简历`
                                : `显示 ${group.items.length} / 共 ${totalCount} 份简历`
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 px-2 text-xs"
                            onClick={() => handleCompareLatestTwo(group.familyId)}
                            disabled={(familySizes.get(group.familyId) ?? group.items.length) < 2}
                          >
                            <Icon icon="mdi:compare-horizontal" className="h-4 w-4" /> 对比最近两版
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  {group.items.map((it) => (
                    <TableRow key={it.id} className="group/row">
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border"
                          checked={selected.has(it.id)}
                          onChange={(e) => toggleSelect(it.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-center text-xs">
                        {it.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="bg-muted ring-border/60 group-hover/row:bg-background mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full shadow-xs ring-1 transition-all duration-200 group-hover/row:shadow-sm">
                          <img
                            src={it.resumeData.avatar || '/not-set.png'}
                            alt={it.resumeData.title}
                            className="h-full w-full object-cover"
                            onError={(ev) => {
                              ;(ev.currentTarget as HTMLImageElement).src = '/default-avatar.jpg'
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5 py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tracking-tight">
                              {it.resumeData.title || '未命名'}
                            </span>
                            <Badge variant="outline" className="bg-background/70 text-[11px]">
                              {getResumeVariantLabel(it.lineage.variantKind)}
                            </Badge>
                          </div>
                          {getResumeLineageHint(it.lineage) ? (
                            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-5">
                              <Icon icon="mdi:source-branch" className="h-3.5 w-3.5" />
                              <p>{getResumeLineageHint(it.lineage)}</p>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {new Date(it.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {new Date(it.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="w-[360px] text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 rounded-full px-3 text-xs shadow-none"
                            onClick={() => navigate(`/edit/${it.id}`)}
                          >
                            <Icon icon="mdi:pencil" className="h-4 w-4" /> 编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 rounded-full px-3 text-xs"
                            onClick={() => navigate(`/view/${it.id}`)}
                          >
                            <Icon icon="mdi:eye" className="h-4 w-4" /> 查看
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground gap-1.5 rounded-full px-3 text-xs"
                              >
                                更多
                                <Icon icon="mdi:chevron-down" className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openDetailInspector(it.id)}>
                                <Icon icon="mdi:dock-window" className="h-4 w-4" />
                                详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCompareWithLatest(it)}>
                                <Icon icon="mdi:compare-horizontal" className="h-4 w-4" />
                                对比
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <ExportButton resumeData={it.resumeData} renderMode="submenu" />
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleClone(it.id)}>
                                <Icon icon="mdi:content-copy" className="h-4 w-4" />
                                克隆
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setSelected(new Set([it.id]))
                                  setConfirmOpen(true)
                                }}
                              >
                                <Icon icon="mdi:delete" className="h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 删除确认 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除所选简历？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销，建议先导出重要的简历数据为 JSON 文件保存。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDelete(visibleSelectedIds)
                setConfirmOpen(false)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={inspector !== null} onOpenChange={closeInspector}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto sm:max-w-none xl:max-w-[min(96vw,1800px)]"
        >
          <SheetHeader className="border-b pr-12 pb-4">
            <SheetTitle>{inspector?.mode === 'compare' ? '版本对比' : '版本详情'}</SheetTitle>
            <SheetDescription>
              {inspector?.mode === 'compare'
                ? `同一家族内并排查看两个版本，快速判断迭代方向。`
                : '在当前页快速查看版本内容与谱系信息，无需跳转路由。'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-4 md:p-6">
            {inspector?.mode === 'detail' ? (
              inspectorDetailResume ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">详情</Badge>
                    <Badge variant="outline">
                      {getResumeVariantLabel(inspectorDetailResume.lineage.variantKind)}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      家族 ID（前 8 位） {getFamilyId(inspectorDetailResume).slice(0, 8)}
                    </span>
                    {getResumeLineageHint(inspectorDetailResume.lineage) ? (
                      <span className="text-muted-foreground text-xs">
                        {getResumeLineageHint(inspectorDetailResume.lineage)}
                      </span>
                    ) : null}
                  </div>
                  {inspectorDetailMetadata ? (
                    <div className="bg-muted/20 grid gap-2 rounded-xl border p-3 sm:grid-cols-2 xl:grid-cols-5">
                      {inspectorDetailMetadata.map((item) => (
                        <div key={item.label} className="bg-background rounded-lg border px-3 py-2">
                          <p className="text-muted-foreground text-[11px] leading-5">
                            {item.label}
                          </p>
                          <p className="text-sm font-medium break-all">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {renderPreviewPanel(inspectorDetailResume, '当前版本')}
                </>
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                  当前查看的版本不存在，可能已被删除，请关闭面板后重新选择。
                </div>
              )
            ) : null}

            {inspector?.mode === 'compare' && inspectorCompareResumes ? (
              inspectorCompareResumes.left && inspectorCompareResumes.right ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">对比</Badge>
                    <span className="text-muted-foreground text-xs">
                      家族 ID（前 8 位） {inspector.familyId.slice(0, 8)}
                    </span>
                  </div>
                  {inspectorCompareSummary ? (
                    <div className="bg-muted/20 space-y-4 rounded-xl border p-4">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="bg-background rounded-lg border px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{inspectorCompareSummary.leftLabel}</Badge>
                            <Badge variant="outline">
                              {inspectorCompareSummary.leftVariantLabel}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-medium">
                            {inspectorCompareSummary.leftTitle}
                          </p>
                        </div>
                        <div className="bg-background rounded-lg border px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{inspectorCompareSummary.rightLabel}</Badge>
                            <Badge variant="outline">
                              {inspectorCompareSummary.rightVariantLabel}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-medium">
                            {inspectorCompareSummary.rightTitle}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                        <div className="bg-background rounded-lg border px-3 py-2">
                          <p className="text-muted-foreground text-[11px] leading-5">较新版本</p>
                          <p className="text-sm font-medium">
                            {inspectorCompareSummary.newerSide === 'same'
                              ? '两侧同步'
                              : inspectorCompareSummary.newerSide === 'left'
                                ? '左侧较新'
                                : '右侧较新'}
                          </p>
                        </div>
                        <div className="bg-background rounded-lg border px-3 py-2">
                          <p className="text-muted-foreground text-[11px] leading-5">模块数变化</p>
                          <p className="text-sm font-medium">
                            {inspectorCompareResumes.left.resumeData.modules.length} →{' '}
                            {inspectorCompareResumes.right.resumeData.modules.length} (
                            {inspectorCompareSummary.moduleDelta > 0 ? '+' : ''}
                            {inspectorCompareSummary.moduleDelta})
                          </p>
                        </div>
                        <div className="bg-background rounded-lg border px-3 py-2">
                          <p className="text-muted-foreground text-[11px] leading-5">
                            个人信息项变化
                          </p>
                          <p className="text-sm font-medium">
                            {getPersonalInfoCount(inspectorCompareResumes.left)} →{' '}
                            {getPersonalInfoCount(inspectorCompareResumes.right)} (
                            {inspectorCompareSummary.personalInfoDelta > 0 ? '+' : ''}
                            {inspectorCompareSummary.personalInfoDelta})
                          </p>
                        </div>
                        <div className="bg-background rounded-lg border px-3 py-2">
                          <p className="text-muted-foreground text-[11px] leading-5">头像状态</p>
                          <p className="text-sm font-medium">
                            {inspectorCompareSummary.avatarChanged ? '已变化' : '未变化'}
                          </p>
                        </div>
                        <div className="bg-background rounded-lg border px-3 py-2">
                          <p className="text-muted-foreground text-[11px] leading-5">求职意向</p>
                          <p className="text-sm font-medium">
                            {inspectorCompareSummary.jobIntentionChanged ? '已变化' : '未变化'}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-3">
                        {renderCompareModuleList(
                          '共享模块',
                          inspectorCompareSummary.sharedModuleTitles,
                          'secondary',
                        )}
                        {renderCompareModuleList(
                          '仅左侧模块',
                          inspectorCompareSummary.leftOnlyModuleTitles,
                        )}
                        {renderCompareModuleList(
                          '仅右侧模块',
                          inspectorCompareSummary.rightOnlyModuleTitles,
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-6 xl:grid xl:grid-cols-2 xl:items-start">
                    {renderPreviewPanel(
                      inspectorCompareResumes.left,
                      inspectorCompareSummary?.leftLabel ?? '左侧版本',
                    )}
                    {renderPreviewPanel(
                      inspectorCompareResumes.right,
                      inspectorCompareSummary?.rightLabel ?? '右侧版本',
                      'right',
                    )}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                  对比对象不存在，可能已被删除，请关闭面板后重新选择。
                </div>
              )
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
