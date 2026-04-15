import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import {
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { AISettingsDialog } from '@/components/ai-settings-dialog'
import { ApplicationBoardDeleteDialog } from '@/components/application-board-delete-dialog'
import { ApplicationBoardEmptyState } from '@/components/application-board-empty-state'
import { ApplicationBoardHeader } from '@/components/application-board-header'
import { ApplicationBoardKanban } from '@/components/application-board-kanban'
import { ApplicationBoardNoResults } from '@/components/application-board-no-results'
import type { RenderApplicationCardArgs, StatusMeta } from '@/components/application-board-types'
import { useToast } from '@/hooks/use-toast'
import JobApplicationDialog from '@/components/job-application-dialog'
import { ApplicationCard } from '@/components/application-card'
import { aiAnalyzeJD, applyAiPatchToResumeData, JD_SUGGESTION_MODULE_TITLE } from '@/lib/ai-service'
import { getResumeDisplayTitle, getResumeVariantLabel } from '@/lib/resume-lineage'
import {
  createEntryFromData,
  createApplication,
  deleteApplications,
  getAllApplications,
  getAllResumes,
  getResumeById,
  updateApplication,
} from '@/lib/storage'
import type { ApplicationEntry, ApplicationInput, ApplicationStatus } from '@/types/application'
import type { StoredResume } from '@/types/resume'

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
    source: application.source,
    contactName: application.contactName,
    contactChannel: application.contactChannel,
    lastContactAt: application.lastContactAt,
    nextAction: application.nextAction,
    interviewStage: application.interviewStage,
    interviewRound: application.interviewRound,
    blockedReason: application.blockedReason,
    result: application.result,
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

function formatLooseDate(value?: string, options?: Intl.DateTimeFormatOptions) {
  const normalized = value?.trim()
  if (!normalized) {
    return ''
  }

  const timestamp = Date.parse(normalized)
  const parsed = Number.isNaN(timestamp) ? null : new Date(timestamp)
  if (!parsed) {
    return normalized
  }

  return parsed.toLocaleString('zh-CN', options)
}

function isApplicationStatus(value: string): value is ApplicationStatus {
  return STATUS_ORDER.includes(value as ApplicationStatus)
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
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null)
  const tailoringIdsRef = useRef(new Set<string>())
  const cardWidthsRef = useRef(new Map<string, number>())
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

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
        title: getResumeDisplayTitle(resume),
      })),
    [resumes],
  )

  const resumeMap = useMemo(() => new Map(resumes.map((resume) => [resume.id, resume])), [resumes])

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
        application.nextAction,
        application.interviewStage,
        application.interviewRound,
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

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveApplicationId(String(active.id))
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveApplicationId(null)
    if (!over) return

    const nextStatus = String(over.id)
    const previousStatus = String(active.data.current?.status ?? '')
    if (!isApplicationStatus(nextStatus) || !isApplicationStatus(previousStatus)) return
    if (nextStatus === previousStatus) return

    const target = applications.find((application) => application.id === String(active.id))
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

  const handleDragCancel = () => {
    setActiveApplicationId(null)
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

    if (tailoringIdsRef.current.has(application.id)) return

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

      const newEntry = await createEntryFromData(data, {
        familyId: resume.lineage.familyId,
        parentResumeId: resume.id,
        variantKind: 'jdTailored',
        sourceApplicationId: application.id,
      })
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

  const renderApplicationCard = ({
    application,
    linkedResumeTitle,
    tailoring,
    isDragging,
    fixedWidth,
    style,
    setRef,
    dragHandle,
    previewOnly = false,
    movingId: currentMovingId,
    onEdit,
    onDelete,
    onTailor,
  }: RenderApplicationCardArgs) => {
    const resumeVariantLabel =
      application.resumeId && resumeMap.get(application.resumeId)
        ? getResumeVariantLabel(resumeMap.get(application.resumeId)!.lineage.variantKind)
        : undefined

    return (
      <ApplicationCard
        application={application}
        linkedResumeTitle={linkedResumeTitle}
        resumeVariantLabel={resumeVariantLabel}
        tailoring={tailoring}
        isDragging={isDragging}
        fixedWidth={fixedWidth}
        style={style}
        setRef={setRef}
        dragHandle={dragHandle}
        previewOnly={previewOnly}
        movingId={currentMovingId}
        onEdit={onEdit}
        onDelete={onDelete}
        onTailor={onTailor}
        formatLooseDate={formatLooseDate}
        formatDateLabel={formatDateLabel}
      />
    )
  }

  const activeApplication = useMemo(
    () => applications.find((application) => application.id === activeApplicationId) ?? null,
    [activeApplicationId, applications],
  )

  const activeLinkedResumeTitle = activeApplication
    ? activeApplication.resumeTitle ||
      (activeApplication.resumeId ? resumeTitleMap.get(activeApplication.resumeId) : undefined)
    : undefined

  const activeApplicationWidth = activeApplicationId
    ? cardWidthsRef.current.get(activeApplicationId)
    : undefined

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
      <ApplicationBoardHeader
        applicationsCount={applications.length}
        keyword={keyword}
        resumeLoadFailed={resumeLoadFailed}
        onKeywordChange={setKeyword}
        onNavigateResumes={() => navigate('/resumes')}
        onOpenAiSettings={() => setAiSettingsOpen(true)}
        onCreate={() => {
          setEditingItem(null)
          setDialogOpen(true)
        }}
      />

      <div className="px-4 py-5 lg:px-6">
        {applications.length === 0 ? (
          <ApplicationBoardEmptyState
            onCreate={() => {
              setEditingItem(null)
              setDialogOpen(true)
            }}
            onNavigateResumes={() => navigate('/resumes')}
          />
        ) : filteredApplications.length === 0 ? (
          <ApplicationBoardNoResults onClear={() => setKeyword('')} />
        ) : (
          <ApplicationBoardKanban
            sensors={sensors}
            collisionDetection={closestCorners}
            statusOrder={STATUS_ORDER}
            groupedApplications={groupedApplications}
            statusMeta={STATUS_META}
            movingId={movingId}
            resumeTitleMap={resumeTitleMap}
            tailoringIds={tailoringIds}
            cardWidthsRef={cardWidthsRef}
            renderApplicationCard={renderApplicationCard}
            activeApplication={activeApplication}
            activeLinkedResumeTitle={activeLinkedResumeTitle}
            activeApplicationWidth={activeApplicationWidth}
            onDragStart={handleDragStart}
            onDragEnd={(event) => void handleDragEnd(event)}
            onDragCancel={handleDragCancel}
            onEdit={(application) => {
              setEditingItem(application)
              setDialogOpen(true)
            }}
            onDelete={setDeleteTarget}
            onTailor={handleCreateTailoredResume}
          />
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

      <ApplicationBoardDeleteDialog
        target={deleteTarget}
        deleting={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
