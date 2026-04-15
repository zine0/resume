import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useToast } from '@/hooks/use-toast'
import type { ApplicationEntry } from '@/types/application'
import type { StoredResume } from '@/types/resume'
import {
  StorageError,
  createEntryFromData,
  deleteResumes,
  getAllApplications,
  getAllResumes,
  getDefaultResumeData,
  importResumeFile,
  loadDefaultTemplate,
  loadExampleTemplate,
} from '@/lib/storage'
import { UserCenterInspectorSheet } from '@/components/user-center-inspector-sheet'
import { UserCenterTable } from '@/components/user-center-table'
import { UserCenterToolbar } from '@/components/user-center-toolbar'
import {
  formatApplicationDate,
  formatApplicationStatusSummary,
  formatInspectorTime,
  getFamilyId,
  getPersonalInfoCount,
  sortApplicationsByUpdatedAt,
  useUserCenterInspector,
} from '@/hooks/use-user-center-inspector'

type SortKey = 'name' | 'createdAt' | 'updatedAt'
type SortDir = 'asc' | 'desc'

interface ResumeFamilyGroup {
  familyId: string
  items: StoredResume[]
}

export default function UserCenter() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [items, setItems] = useState<StoredResume[]>([])
  const [applications, setApplications] = useState<ApplicationEntry[]>([])
  const [applicationsAvailable, setApplicationsAvailable] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importing, setImporting] = useState(false)

  const refresh = useCallback(async () => {
    const [resumesResult, applicationsResult] = await Promise.allSettled([
      getAllResumes(),
      getAllApplications(),
    ])

    if (resumesResult.status === 'fulfilled') {
      setItems(resumesResult.value)
    } else {
      toast({
        title: '读取失败',
        description:
          resumesResult.reason instanceof Error ? resumesResult.reason.message : '无法读取本地存储',
      })
    }

    if (applicationsResult.status === 'fulfilled') {
      setApplications(applicationsResult.value)
      setApplicationsAvailable(true)
    } else {
      setApplications([])
      setApplicationsAvailable(false)
      toast({
        title: '求职记录读取失败',
        description:
          applicationsResult.reason instanceof Error
            ? `${applicationsResult.reason.message}，将暂不显示简历使用情况。`
            : '将暂不显示简历使用情况。',
      })
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
  const applicationMap = useMemo(
    () => new Map(applications.map((application) => [application.id, application])),
    [applications],
  )
  const applicationsByResumeId = useMemo(() => {
    const map = new Map<string, ApplicationEntry[]>()

    for (const application of applications) {
      const resumeId = application.resumeId?.trim()
      if (!resumeId) {
        continue
      }

      const current = map.get(resumeId)
      if (current) {
        current.push(application)
      } else {
        map.set(resumeId, [application])
      }
    }

    for (const [resumeId, linkedApplications] of map.entries()) {
      map.set(resumeId, sortApplicationsByUpdatedAt(linkedApplications))
    }

    return map
  }, [applications])
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
  const {
    inspector,
    inspectorDetailResume,
    inspectorDetailMetadata,
    inspectorDetailApplications,
    inspectorDetailSourceApplication,
    inspectorDetailLatestApplication,
    inspectorCompareResumes,
    inspectorCompareSummary,
    openDetailInspector,
    handleCompareWithLatest,
    handleCompareLatestTwo,
    closeInspector,
  } = useUserCenterInspector({
    itemMap,
    applicationMap,
    applicationsByResumeId,
    familyItemsMap,
    notify: ({ title, description }) => toast({ title, description }),
  })

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

      <UserCenterToolbar
        itemsCount={items.length}
        importing={importing}
        keyword={keyword}
        hasItems={items.length > 0}
        selectedCount={visibleSelectedIds.length}
        onKeywordChange={setKeyword}
        onNavigateBoard={() => navigate('/')}
        onImport={() => document.getElementById('uc-import-file')?.click()}
        onCreate={handleCreate}
        onDeleteSelected={() => setConfirmOpen(true)}
      />

      <Separator />

      <UserCenterTable
        itemsCount={items.length}
        filteredSorted={filteredSorted}
        groupedFamilies={groupedFamilies}
        familySizes={familySizes}
        selected={selected}
        visibleSelectedIds={visibleSelectedIds}
        allVisibleSelected={allVisibleSelected}
        sortKey={sortKey}
        sortDir={sortDir}
        applicationsAvailable={applicationsAvailable}
        applicationsByResumeId={applicationsByResumeId}
        importing={importing}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelect={toggleSelect}
        onSortChange={(field, dir) => {
          setSortKey(field)
          setSortDir(dir)
        }}
        onCompareLatestTwo={handleCompareLatestTwo}
        onEdit={(id) => navigate(`/edit/${id}`)}
        onView={(id) => navigate(`/view/${id}`)}
        onOpenDetail={openDetailInspector}
        onCompareWithLatest={handleCompareWithLatest}
        onClone={handleClone}
        onDeleteOne={(id) => {
          setSelected(new Set([id]))
          setConfirmOpen(true)
        }}
        onCreate={handleCreate}
        onImport={() => document.getElementById('uc-import-file')?.click()}
        onNavigateBoard={() => navigate('/')}
        onOpenExample={() => prefetchAndOpenNew('example')}
        onOpenGitHub={() =>
          window.open('https://github.com/wzdnzd/resume', '_blank', 'noopener,noreferrer')
        }
        onClearKeyword={() => setKeyword('')}
      />

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

      <UserCenterInspectorSheet
        inspector={inspector}
        applicationsAvailable={applicationsAvailable}
        inspectorDetailResume={inspectorDetailResume}
        inspectorDetailMetadata={inspectorDetailMetadata}
        inspectorDetailApplications={inspectorDetailApplications}
        inspectorDetailSourceApplication={inspectorDetailSourceApplication}
        inspectorDetailLatestApplication={inspectorDetailLatestApplication}
        inspectorCompareResumes={inspectorCompareResumes}
        inspectorCompareSummary={inspectorCompareSummary}
        onOpenChange={closeInspector}
        formatInspectorTime={formatInspectorTime}
        formatApplicationDate={formatApplicationDate}
        formatApplicationStatusSummary={formatApplicationStatusSummary}
        getFamilyId={getFamilyId}
        getPersonalInfoCount={getPersonalInfoCount}
      />
    </div>
  )
}
