import { Badge } from '@/components/ui/badge'
import type { ApplicationStatus } from '@/types/application'
import { getResumeLineageHint, getResumeVariantLabel } from '@/lib/resume-lineage'
import type { UserCenterInspectorDetailBodyProps } from '@/components/user-center-inspector-types'
import { UserCenterInspectorPreviewPanel } from '@/components/user-center-inspector-preview-panel'

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

export function UserCenterInspectorDetailBody({
  applicationsAvailable,
  resume,
  metadata,
  applications,
  sourceApplication,
  latestApplication,
  formatInspectorTime,
  formatApplicationDate,
  formatApplicationStatusSummary,
  getFamilyId,
}: UserCenterInspectorDetailBodyProps) {
  if (!resume) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        当前查看的版本不存在，可能已被删除，请关闭面板后重新选择。
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">详情</Badge>
        <Badge variant="outline">{getResumeVariantLabel(resume.lineage.variantKind)}</Badge>
        <span className="text-muted-foreground text-xs">
          家族 ID（前 8 位） {getFamilyId(resume).slice(0, 8)}
        </span>
        {getResumeLineageHint(resume.lineage) ? (
          <span className="text-muted-foreground text-xs">
            {getResumeLineageHint(resume.lineage)}
          </span>
        ) : null}
      </div>
      {metadata ? (
        <div className="bg-muted/20 grid gap-2 rounded-xl border p-3 sm:grid-cols-2 xl:grid-cols-5">
          {metadata.map((item) => (
            <div key={item.label} className="bg-background rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-[11px] leading-5">{item.label}</p>
              <p className="text-sm font-medium break-all">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="bg-muted/20 space-y-4 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">使用情况</Badge>
          <span className="text-muted-foreground text-xs">
            {applications.length > 0
              ? `当前有 ${applications.length} 条求职记录引用此版本。`
              : applicationsAvailable
                ? '当前还没有求职记录引用此版本。'
                : '求职记录暂未加载，当前无法判断这份简历的使用情况。'}
          </span>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-background rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-[11px] leading-5">关联投递</p>
            <p className="text-sm font-medium">
              {applicationsAvailable ? `${applications.length} 条` : '暂不可用'}
            </p>
          </div>
          <div className="bg-background rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-[11px] leading-5">流程分布</p>
            <p className="text-sm font-medium break-words">
              {applicationsAvailable
                ? applications.length > 0
                  ? formatApplicationStatusSummary(applications)
                  : '暂无'
                : '暂不可用'}
            </p>
          </div>
          <div className="bg-background rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-[11px] leading-5">最近关联更新</p>
            <p className="text-sm font-medium break-words">
              {applicationsAvailable
                ? latestApplication
                  ? formatInspectorTime(latestApplication.updatedAt)
                  : '暂无'
                : '暂不可用'}
            </p>
          </div>
          <div className="bg-background rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-[11px] leading-5">来源岗位</p>
            <p className="text-sm font-medium break-words">
              {sourceApplication
                ? `${sourceApplication.company} · ${sourceApplication.role}`
                : resume.lineage.sourceApplicationId
                  ? applicationsAvailable
                    ? '来源岗位记录不可用'
                    : '求职记录暂未加载'
                  : '无'}
            </p>
          </div>
        </div>

        {applicationsAvailable ? (
          applications.length > 0 ? (
            <div className="space-y-2">
              {applications.map((application) => (
                <div
                  key={application.id}
                  className="bg-background space-y-2 rounded-lg border px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium break-words">
                        {application.company} · {application.role}
                      </p>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span>记录 {application.id.slice(0, 8)}</span>
                        {application.appliedAt ? (
                          <span>
                            投递{' '}
                            {formatApplicationDate(application.appliedAt, {
                              month: 'numeric',
                              day: 'numeric',
                            })}
                          </span>
                        ) : null}
                        <span>更新 {formatInspectorTime(application.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Badge
                        variant="outline"
                        className={APPLICATION_STATUS_META[application.status].className}
                      >
                        {APPLICATION_STATUS_META[application.status].label}
                      </Badge>
                      {application.source?.trim() ? (
                        <Badge variant="outline">来源 {application.source.trim()}</Badge>
                      ) : null}
                      {application.id === resume.lineage.sourceApplicationId ? (
                        <Badge variant="secondary">来源岗位</Badge>
                      ) : null}
                    </div>
                  </div>

                  {application.nextAction?.trim() ? (
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span>下一步：{application.nextAction.trim()}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              后续在求职看板里关联到这份简历的投递记录，会自动出现在这里。
            </div>
          )
        ) : (
          <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            求职记录暂未加载，当前无法展示这份简历的关联投递明细。
          </div>
        )}
      </div>
      <UserCenterInspectorPreviewPanel resume={resume} label="当前版本" getFamilyId={getFamilyId} />
    </>
  )
}
