import { Badge } from '@/components/ui/badge'
import type { UserCenterInspectorCompareBodyProps } from '@/components/user-center-inspector-types'
import { UserCenterInspectorPreviewPanel } from '@/components/user-center-inspector-preview-panel'

function CompareModuleList({
  label,
  titles,
  badgeVariant = 'outline',
}: {
  label: string
  titles: string[]
  badgeVariant?: 'secondary' | 'outline'
}) {
  return (
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
}

export function UserCenterInspectorCompareBody({
  inspector,
  resumes,
  summary,
  getFamilyId,
  getPersonalInfoCount,
}: UserCenterInspectorCompareBodyProps) {
  if (!resumes) {
    return null
  }

  if (!resumes.left || !resumes.right) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        对比对象不存在，可能已被删除，请关闭面板后重新选择。
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">对比</Badge>
        <span className="text-muted-foreground text-xs">
          家族 ID（前 8 位） {inspector.familyId.slice(0, 8)}
        </span>
      </div>
      {summary ? (
        <div className="bg-muted/20 space-y-4 rounded-xl border p-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="bg-background rounded-lg border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{summary.leftLabel}</Badge>
                <Badge variant="outline">{summary.leftVariantLabel}</Badge>
              </div>
              <p className="mt-2 text-sm font-medium">{summary.leftTitle}</p>
            </div>
            <div className="bg-background rounded-lg border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{summary.rightLabel}</Badge>
                <Badge variant="outline">{summary.rightVariantLabel}</Badge>
              </div>
              <p className="mt-2 text-sm font-medium">{summary.rightTitle}</p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <div className="bg-background rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-[11px] leading-5">较新版本</p>
              <p className="text-sm font-medium">
                {summary.newerSide === 'same'
                  ? '两侧同步'
                  : summary.newerSide === 'left'
                    ? '左侧较新'
                    : '右侧较新'}
              </p>
            </div>
            <div className="bg-background rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-[11px] leading-5">模块数变化</p>
              <p className="text-sm font-medium">
                {resumes.left.resumeData.modules.length} → {resumes.right.resumeData.modules.length}{' '}
                ({summary.moduleDelta > 0 ? '+' : ''}
                {summary.moduleDelta})
              </p>
            </div>
            <div className="bg-background rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-[11px] leading-5">个人信息项变化</p>
              <p className="text-sm font-medium">
                {getPersonalInfoCount(resumes.left)} → {getPersonalInfoCount(resumes.right)} (
                {summary.personalInfoDelta > 0 ? '+' : ''}
                {summary.personalInfoDelta})
              </p>
            </div>
            <div className="bg-background rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-[11px] leading-5">头像状态</p>
              <p className="text-sm font-medium">{summary.avatarChanged ? '已变化' : '未变化'}</p>
            </div>
            <div className="bg-background rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-[11px] leading-5">求职意向</p>
              <p className="text-sm font-medium">
                {summary.jobIntentionChanged ? '已变化' : '未变化'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <CompareModuleList
              label="共享模块"
              titles={summary.sharedModuleTitles}
              badgeVariant="secondary"
            />
            <CompareModuleList label="仅左侧模块" titles={summary.leftOnlyModuleTitles} />
            <CompareModuleList label="仅右侧模块" titles={summary.rightOnlyModuleTitles} />
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-2 xl:items-start">
        <UserCenterInspectorPreviewPanel
          resume={resumes.left}
          label={summary?.leftLabel ?? '左侧版本'}
          getFamilyId={getFamilyId}
        />
        <UserCenterInspectorPreviewPanel
          resume={resumes.right}
          label={summary?.rightLabel ?? '右侧版本'}
          getFamilyId={getFamilyId}
          align="right"
        />
      </div>
    </>
  )
}
