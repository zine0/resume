import { useMemo, useState } from 'react'
import type { ApplicationEntry, ApplicationStatus } from '@/types/application'
import type { StoredResume } from '@/types/resume'
import type {
  ResumeCompareSummary,
  ResumeInspectorMetadataItem,
  ResumeInspectorState,
} from '@/components/user-center-inspector-types'
import { getResumeLineageHint, getResumeVariantLabel } from '@/lib/resume-lineage'

const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; className: string }> = {
  wishlist: {
    label: '待投递',
    className: 'border-border bg-background text-muted-foreground',
  },
  applied: {
    label: '已投递',
    className: 'border-primary/20 bg-primary/10 text-primary',
  },
  interview: {
    label: '面试中',
    className: 'border-chart-2/20 bg-chart-2/12 text-chart-2',
  },
  offer: {
    label: 'Offer',
    className: 'border-chart-4/25 bg-chart-4/12 text-chart-4',
  },
  rejected: {
    label: '未通过',
    className: 'border-chart-3/20 bg-chart-3/12 text-chart-3',
  },
}

const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  'wishlist',
  'applied',
  'interview',
  'offer',
  'rejected',
]

export function getFamilyId(item: StoredResume): string {
  return item.lineage.familyId || item.id
}

export function formatInspectorTime(value: string): string {
  return new Date(value).toLocaleString()
}

function getResumeTitle(resume: StoredResume): string {
  return resume.resumeData.title || '未命名简历'
}

export function sortApplicationsByUpdatedAt(items: ApplicationEntry[]): ApplicationEntry[] {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function formatApplicationDate(
  value?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const normalized = value?.trim()
  if (!normalized) {
    return ''
  }

  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) {
    return normalized
  }

  return new Date(parsed).toLocaleString('zh-CN', options)
}

export function formatApplicationStatusSummary(applications: ApplicationEntry[]): string {
  const counts = new Map<ApplicationStatus, number>()

  for (const application of applications) {
    counts.set(application.status, (counts.get(application.status) ?? 0) + 1)
  }

  return APPLICATION_STATUS_ORDER.filter((status) => counts.has(status))
    .map((status) => `${APPLICATION_STATUS_META[status].label} ${counts.get(status)}`)
    .join(' · ')
}

export function getPersonalInfoCount(resume: StoredResume): number {
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

interface UseUserCenterInspectorOptions {
  itemMap: Map<string, StoredResume>
  applicationMap: Map<string, ApplicationEntry>
  applicationsByResumeId: Map<string, ApplicationEntry[]>
  familyItemsMap: Map<string, StoredResume[]>
  notify: (options: { title: string; description: string }) => void
}

export function useUserCenterInspector({
  itemMap,
  applicationMap,
  applicationsByResumeId,
  familyItemsMap,
  notify,
}: UseUserCenterInspectorOptions) {
  const [inspector, setInspector] = useState<ResumeInspectorState | null>(null)

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

  const inspectorDetailApplications = useMemo(
    () =>
      inspectorDetailResume ? (applicationsByResumeId.get(inspectorDetailResume.id) ?? []) : [],
    [applicationsByResumeId, inspectorDetailResume],
  )

  const inspectorDetailSourceApplication = useMemo(() => {
    const sourceApplicationId = inspectorDetailResume?.lineage.sourceApplicationId
    return sourceApplicationId ? (applicationMap.get(sourceApplicationId) ?? null) : null
  }, [applicationMap, inspectorDetailResume])

  const inspectorDetailLatestApplication = inspectorDetailApplications[0] ?? null

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
      notify({ title: '无法对比', description: '请至少选择同家族中的两个不同版本。' })
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
      notify({ title: '暂无可对比版本', description: '该版本家族当前只有一份简历。' })
      return
    }

    const latest = familyItems[0]
    const fallback = familyItems[1]
    const target = latest.id === resume.id ? fallback : latest

    if (!target) {
      notify({ title: '无法对比', description: '未找到适合的对比版本，请稍后重试。' })
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
      notify({ title: '暂无可对比版本', description: '该版本家族当前只有一份简历。' })
      return
    }

    openCompareInspector(familyId, familyItems[1].id, familyItems[0].id, {
      left: '较早版本',
      right: '较新版本',
    })
  }

  const closeInspector = (open: boolean) => {
    if (!open) {
      setInspector(null)
    }
  }

  return {
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
    getFamilyId,
    formatInspectorTime,
    formatApplicationDate,
    formatApplicationStatusSummary,
    getPersonalInfoCount,
  }
}
