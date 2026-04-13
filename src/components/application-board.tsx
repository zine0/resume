import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
import { AISettingsDialog } from '@/components/ai-settings-dialog'
import { useToast } from '@/hooks/use-toast'
import JobApplicationDialog from '@/components/job-application-dialog'
import { aiAnalyzeJD, applyAiPatchToResumeData, JD_SUGGESTION_MODULE_TITLE } from '@/lib/ai-service'
import {
  createEntryFromData,
  createApplication,
  deleteApplications,
  getAllApplications,
  getAllResumes,
  getResumeById,
  updateApplication,
} from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { ApplicationEntry, ApplicationInput, ApplicationStatus } from '@/types/application'
import type { StoredResume } from '@/types/resume'

interface StatusMeta {
  label: string
  icon: string
  surfaceClass: string
  badgeClass: string
  emptyCopy: string
}

const STATUS_ORDER: ApplicationStatus[] = ['wishlist', 'applied', 'interview', 'offer', 'rejected']

const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  wishlist: {
    label: '待投递',
    icon: 'mdi:clipboard-text-outline',
    surfaceClass: 'border-border bg-muted/30',
    badgeClass: 'text-muted-foreground bg-background',
    emptyCopy: '把感兴趣的岗位先放到这里，统一整理后再投。',
  },
  applied: {
    label: '已投递',
    icon: 'mdi:send-check-outline',
    surfaceClass: 'bg-primary/5 border-primary/15',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    emptyCopy: '已投递的岗位会集中显示，方便继续跟进反馈。',
  },
  interview: {
    label: '面试中',
    icon: 'mdi:account-voice-outline',
    surfaceClass: 'bg-chart-2/10 border-chart-2/20',
    badgeClass: 'bg-chart-2/12 text-chart-2 border-chart-2/20',
    emptyCopy: '进入沟通或面试阶段后，拖到这里持续追踪进度。',
  },
  offer: {
    label: 'Offer',
    icon: 'mdi:medal-outline',
    surfaceClass: 'bg-chart-4/10 border-chart-4/22',
    badgeClass: 'bg-chart-4/12 text-chart-4 border-chart-4/25',
    emptyCopy: '拿到 Offer 的岗位会沉淀在这里，方便比较与决策。',
  },
  rejected: {
    label: '未通过',
    icon: 'mdi:close-octagon-outline',
    surfaceClass: 'bg-chart-3/10 border-chart-3/18',
    badgeClass: 'bg-chart-3/12 text-chart-3 border-chart-3/20',
    emptyCopy: '流程结束的岗位会保留在这里，方便后续复盘和经验沉淀。',
  },
}

function toInput(application: ApplicationEntry): ApplicationInput {
  return {
    status: application.status,
    company: application.company,
    role: application.role,
    jdText: application.jdText,
    resumeId: application.resumeId,
    resumeTitle: application.resumeTitle,
    url: application.url,
    appliedAt: application.appliedAt,
    notes: application.notes,
  }
}

function sortByUpdatedAt(items: ApplicationEntry[]) {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ApplicationBoard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [applications, setApplications] = useState<ApplicationEntry[]>([])
  const [resumes, setResumes] = useState<StoredResume[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [resumeLoadFailed, setResumeLoadFailed] = useState(false)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ApplicationEntry | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApplicationEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [tailoringIds, setTailoringIds] = useState<string[]>([])
  const tailoringIdsRef = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    setLoading(true)
    setResumeLoadFailed(false)
    try {
      const [nextApplications, nextResumes] = await Promise.allSettled([
        getAllApplications(),
        getAllResumes(),
      ])

      if (nextApplications.status === 'fulfilled') {
        setApplications(nextApplications.value)
      } else {
        setApplications([])
        toast({
          title: '读取看板失败',
          description:
            nextApplications.reason instanceof Error
              ? nextApplications.reason.message
              : '无法读取求职看板数据',
          variant: 'destructive',
        })
      }

      if (nextResumes.status === 'fulfilled') {
        setResumes(nextResumes.value)
      } else {
        setResumes([])
        setResumeLoadFailed(true)
        toast({
          title: '简历库暂时不可用',
          description: '仍可继续管理求职记录，稍后可前往简历库重试。',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const resumeOptions = useMemo(
    () =>
      resumes.map((resume) => ({
        id: resume.id,
        title: resume.resumeData.title || '未命名简历',
      })),
    [resumes],
  )

  const resumeTitleMap = useMemo(
    () => new Map(resumes.map((resume) => [resume.id, resume.resumeData.title || '未命名简历'])),
    [resumes],
  )

  const filteredApplications = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) {
      return applications
    }

    return applications.filter((application) =>
      [
        application.company,
        application.role,
        application.jdText,
        application.resumeTitle,
        application.url,
        application.notes,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedKeyword)),
    )
  }, [applications, keyword])

  const groupedApplications = useMemo(() => {
    return STATUS_ORDER.reduce(
      (accumulator, status) => {
        accumulator[status] = sortByUpdatedAt(
          filteredApplications.filter((application) => application.status === status),
        )
        return accumulator
      },
      {
        wishlist: [],
        applied: [],
        interview: [],
        offer: [],
        rejected: [],
      } as Record<ApplicationStatus, ApplicationEntry[]>,
    )
  }, [filteredApplications])

  const summaryCards = useMemo(
    () => [
      {
        label: '总记录',
        value: applications.length,
        icon: 'mdi:view-dashboard-outline',
        tone: 'bg-primary/5 border-primary/15 text-primary',
      },
      {
        label: '推进中',
        value: applications.filter((item) =>
          ['wishlist', 'applied', 'interview'].includes(item.status),
        ).length,
        icon: 'mdi:progress-check',
        tone: 'bg-chart-2/10 border-chart-2/20 text-chart-2',
      },
      {
        label: '面试阶段',
        value: applications.filter((item) => item.status === 'interview').length,
        icon: 'mdi:account-voice-outline',
        tone: 'bg-chart-3/10 border-chart-3/18 text-chart-3',
      },
      {
        label: 'Offer',
        value: applications.filter((item) => item.status === 'offer').length,
        icon: 'mdi:medal-outline',
        tone: 'bg-chart-4/10 border-chart-4/22 text-chart-4',
      },
    ],
    [applications],
  )

  const handleSubmit = async (values: ApplicationInput) => {
    setSubmitting(true)
    try {
      if (editingItem) {
        const updated = await updateApplication(editingItem.id, values)
        setApplications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        toast({
          title: '已更新求职记录',
          description: `${updated.company} · ${updated.role}`,
        })
      } else {
        const created = await createApplication(values)
        setApplications((prev) => [created, ...prev])
        toast({
          title: '已创建求职记录',
          description: `${created.company} · ${created.role}`,
        })
      }
      setDialogOpen(false)
      setEditingItem(null)
    } catch (error) {
      toast({
        title: editingItem ? '保存失败' : '创建失败',
        description: error instanceof Error ? error.message : '求职记录保存失败',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    const nextStatus = result.destination.droppableId as ApplicationStatus
    const previousStatus = result.source.droppableId as ApplicationStatus
    if (nextStatus === previousStatus) return

    const target = applications.find((application) => application.id === result.draggableId)
    if (!target) return

    const previousApplications = applications
    const optimisticUpdatedAt = new Date().toISOString()

    setApplications((prev) =>
      prev.map((application) =>
        application.id === target.id
          ? { ...application, status: nextStatus, updatedAt: optimisticUpdatedAt }
          : application,
      ),
    )
    setMovingId(target.id)

    try {
      const updated = await updateApplication(target.id, {
        ...toInput(target),
        status: nextStatus,
      })
      setApplications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast({ title: '状态已更新', description: `已移动到「${STATUS_META[nextStatus].label}」` })
    } catch (error) {
      setApplications(previousApplications)
      toast({
        title: '拖拽失败',
        description: error instanceof Error ? error.message : '状态更新失败',
        variant: 'destructive',
      })
    } finally {
      setMovingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await deleteApplications([deleteTarget.id])
      setApplications((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      toast({
        title: '已删除记录',
        description: `${deleteTarget.company} · ${deleteTarget.role}`,
      })
      setDeleteTarget(null)
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '无法删除求职记录',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateTailoredResume = async (application: ApplicationEntry) => {
    if (!application.resumeId) {
      toast({
        title: '请先关联简历',
        description: '当前记录还没有绑定简历，无法直接生成 JD 定制副本。',
        variant: 'destructive',
      })
      return
    }

    const jdText = application.jdText?.trim()
    if (!jdText) {
      toast({
        title: '请先补充 JD',
        description: '当前记录还没有填写职位描述，无法进行 JD 定制。',
        variant: 'destructive',
      })
      return
    }

    if (tailoringIdsRef.current.has(application.id)) {
      return
    }

    tailoringIdsRef.current.add(application.id)
    setTailoringIds((prev) => [...prev, application.id])

    let createdResumeTitle: string | null = null

    try {
      const resume = await getResumeById(application.resumeId)
      if (!resume) {
        toast({
          title: '关联简历不存在',
          description: '当前绑定的简历无法加载，请重新关联后再试。',
          variant: 'destructive',
        })
        return
      }

      const analysisResult = await aiAnalyzeJD(resume.resumeData, jdText)
      const { data, appliedCount, unmatchedCount } = applyAiPatchToResumeData(
        resume.resumeData,
        analysisResult.patch,
        { fallbackModuleTitle: JD_SUGGESTION_MODULE_TITLE },
      )

      const newEntry = await createEntryFromData(data)
      createdResumeTitle = newEntry.resumeData.title || '未命名简历'

      const updated = await updateApplication(application.id, {
        ...toInput(application),
        resumeId: newEntry.id,
        resumeTitle: createdResumeTitle,
      })

      setResumes((prev) => [newEntry, ...prev.filter((item) => item.id !== newEntry.id)])
      setApplications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))

      toast({
        title: '已生成 JD 定制简历',
        description:
          unmatchedCount > 0
            ? `已创建「${createdResumeTitle}」，应用 ${appliedCount} 条建议，其余 ${unmatchedCount} 条已加入“${JD_SUGGESTION_MODULE_TITLE}”。`
            : `已创建「${createdResumeTitle}」，并自动绑定到当前岗位。`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法生成 JD 定制简历'
      toast({
        title: 'JD 定制失败',
        description: createdResumeTitle
          ? `${message} 已生成的副本「${createdResumeTitle}」仍保留在简历库中。`
          : message,
        variant: 'destructive',
      })
    } finally {
      tailoringIdsRef.current.delete(application.id)
      setTailoringIds((prev) => prev.filter((id) => id !== application.id))
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
          正在加载求职看板...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/resumes')}
                  className="gap-2 bg-transparent"
                >
                  <Icon icon="mdi:file-document-multiple-outline" className="h-4 w-4" />
                  简历库
                </Button>
                <Separator orientation="vertical" className="hidden h-6 md:block" />
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:view-kanban-outline" className="text-primary h-6 w-6" />
                  <h1 className="text-lg font-semibold">求职看板</h1>
                  <Badge variant="secondary">{applications.length}</Badge>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                把岗位、投递进度和结果放在同一块看板里统一推进，需要时再进入简历库管理版本。
              </p>
              {resumeLoadFailed ? (
                <p className="text-destructive text-sm">
                  简历库加载失败，当前仍可继续管理求职记录。
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索公司、岗位、JD 或备注..."
                className="w-full sm:w-72"
              />
              <Button
                variant="outline"
                onClick={() => setAiSettingsOpen(true)}
                className="gap-2 bg-transparent"
              >
                <Icon icon="mdi:cog-outline" className="h-4 w-4" />
                AI 设置
              </Button>
              <Button
                onClick={() => {
                  setEditingItem(null)
                  setDialogOpen(true)
                }}
                className="gap-2"
              >
                <Icon icon="mdi:plus" className="h-4 w-4" />
                新增记录
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <Card key={card.label} className={cn('gap-3 p-4', card.tone)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{card.label}</span>
                  <Icon icon={card.icon} className="h-5 w-5" />
                </div>
                <div className="text-2xl font-semibold">{card.value}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 lg:px-6">
        {applications.length === 0 ? (
          <Card className="bg-muted/30 mx-auto max-w-2xl gap-4 border-dashed p-10 text-center shadow-sm">
            <div className="bg-primary/10 text-primary mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              <Icon icon="mdi:view-kanban-outline" className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">还没有求职记录</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                先创建第一条记录，把目标岗位放进看板；后续可直接拖拽到不同阶段，持续跟踪投递节奏。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => {
                  setEditingItem(null)
                  setDialogOpen(true)
                }}
                className="gap-2"
              >
                <Icon icon="mdi:plus" className="h-4 w-4" />
                新增第一条记录
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/resumes')}
                className="gap-2 bg-transparent"
              >
                <Icon icon="mdi:file-document-outline" className="h-4 w-4" />
                前往简历库
              </Button>
            </div>
          </Card>
        ) : filteredApplications.length === 0 ? (
          <Card className="bg-muted/30 mx-auto max-w-xl gap-3 border-dashed p-8 text-center shadow-sm">
            <div className="text-muted-foreground mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-dashed">
              <Icon icon="mdi:magnify" className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold">没有匹配到记录</h2>
            <p className="text-muted-foreground text-sm">
              试试更换关键词，或直接新增一条新的求职记录。
            </p>
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setKeyword('')}
                className="gap-2 bg-transparent"
              >
                <Icon icon="mdi:close-circle-outline" className="h-4 w-4" />
                清空搜索
              </Button>
            </div>
          </Card>
        ) : (
          <ScrollArea className="w-full whitespace-nowrap">
            <DragDropContext onDragEnd={(result) => void handleDragEnd(result)}>
              <div className="flex min-w-max gap-4 pb-4">
                {STATUS_ORDER.map((status) => {
                  const meta = STATUS_META[status]
                  const items = groupedApplications[status]

                  return (
                    <Card key={status} className="w-[320px] shrink-0 gap-4 py-4">
                      <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-2">
                          <div className={cn('rounded-lg border p-2', meta.surfaceClass)}>
                            <Icon icon={meta.icon} className="h-4 w-4" />
                          </div>
                          <div>
                            <h2 className="text-sm font-semibold">{meta.label}</h2>
                            <p className="text-muted-foreground text-xs">拖拽卡片即可变更状态</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={meta.badgeClass}>
                          {items.length}
                        </Badge>
                      </div>

                      <Droppable droppableId={status}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              'relative mx-3 min-h-[380px] rounded-xl border border-dashed p-3 transition-colors',
                              meta.surfaceClass,
                              snapshot.isDraggingOver && 'ring-ring/30 ring-2',
                            )}
                          >
                            {items.length === 0 ? (
                              <div className="text-muted-foreground pointer-events-none absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center text-sm leading-relaxed whitespace-normal">
                                {meta.emptyCopy}
                              </div>
                            ) : null}

                            <div className="space-y-3">
                              {items.map((application, index) => {
                                const tailoring = tailoringIds.includes(application.id)
                                const linkedResumeTitle =
                                  application.resumeTitle ||
                                  (application.resumeId
                                    ? resumeTitleMap.get(application.resumeId)
                                    : undefined)

                                return (
                                  <Draggable
                                    key={application.id}
                                    draggableId={application.id}
                                    index={index}
                                  >
                                    {(draggableProvided, draggableSnapshot) => (
                                      <div
                                        ref={draggableProvided.innerRef}
                                        {...draggableProvided.draggableProps}
                                        {...draggableProvided.dragHandleProps}
                                        style={draggableProvided.draggableProps.style}
                                        className={cn(
                                          'whitespace-normal transition-transform',
                                          draggableSnapshot.isDragging && 'rotate-[1deg]',
                                        )}
                                      >
                                        <Card
                                          className={cn(
                                            'gap-3 p-4',
                                            movingId === application.id && 'opacity-70',
                                          )}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                              <p className="text-base leading-tight font-semibold">
                                                {application.company}
                                              </p>
                                              <p className="text-muted-foreground text-sm">
                                                {application.role}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              {application.url ? (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="size-8"
                                                  onClick={() =>
                                                    window.open(
                                                      application.url,
                                                      '_blank',
                                                      'noopener,noreferrer',
                                                    )
                                                  }
                                                >
                                                  <Icon
                                                    icon="mdi:open-in-new"
                                                    className="h-4 w-4"
                                                  />
                                                </Button>
                                              ) : null}
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                onClick={() => {
                                                  setEditingItem(application)
                                                  setDialogOpen(true)
                                                }}
                                              >
                                                <Icon
                                                  icon="mdi:pencil-outline"
                                                  className="h-4 w-4"
                                                />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:bg-destructive size-8 hover:text-white"
                                                onClick={() => setDeleteTarget(application)}
                                              >
                                                <Icon
                                                  icon="mdi:trash-can-outline"
                                                  className="h-4 w-4"
                                                />
                                              </Button>
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap gap-2">
                                            {linkedResumeTitle ? (
                                              <Badge
                                                variant="outline"
                                                className="bg-primary/5 text-primary border-primary/20"
                                              >
                                                简历 · {linkedResumeTitle}
                                              </Badge>
                                            ) : null}
                                            {application.appliedAt ? (
                                              <Badge variant="outline">
                                                投递于 {application.appliedAt}
                                              </Badge>
                                            ) : null}
                                          </div>

                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full gap-2 bg-transparent"
                                            disabled={tailoring}
                                            onClick={() =>
                                              void handleCreateTailoredResume(application)
                                            }
                                          >
                                            {tailoring ? (
                                              <>
                                                <Icon
                                                  icon="lucide:loader-2"
                                                  className="h-4 w-4 animate-spin"
                                                />
                                                定制中...
                                              </>
                                            ) : (
                                              <>
                                                <Icon icon="mdi:sparkles" className="h-4 w-4" />
                                                JD 定制简历
                                              </>
                                            )}
                                          </Button>

                                          {application.jdText ? (
                                            <div className="bg-muted/40 rounded-lg border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                                              <p className="line-clamp-4">
                                                JD：{application.jdText}
                                              </p>
                                            </div>
                                          ) : null}

                                          {application.notes ? (
                                            <div className="bg-muted/40 rounded-lg border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                                              <p className="line-clamp-4">
                                                备注：{application.notes}
                                              </p>
                                            </div>
                                          ) : null}

                                          <div className="text-muted-foreground flex items-center justify-between text-xs">
                                            <span>最近更新</span>
                                            <span>{formatDateLabel(application.updatedAt)}</span>
                                          </div>
                                        </Card>
                                      </div>
                                    )}
                                  </Draggable>
                                )
                              })}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    </Card>
                  )
                })}
              </div>
            </DragDropContext>
          </ScrollArea>
        )}
      </div>

      <JobApplicationDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingItem(null)
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        initialValue={editingItem ? toInput(editingItem) : null}
        resumeOptions={resumeOptions}
      />

      <AISettingsDialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen} />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条求职记录？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `将删除「${deleteTarget.company} · ${deleteTarget.role}」，该操作无法撤销。`
                : '该操作无法撤销。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
