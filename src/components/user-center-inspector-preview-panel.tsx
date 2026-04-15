import ResumePreview from '@/components/resume-preview'
import { Badge } from '@/components/ui/badge'
import { getResumeLineageHint, getResumeVariantLabel } from '@/lib/resume-lineage'
import type { StoredResume } from '@/types/resume'

interface UserCenterInspectorPreviewPanelProps {
  resume: StoredResume
  label: string
  getFamilyId: (item: StoredResume) => string
  align?: 'left' | 'right'
}

export function UserCenterInspectorPreviewPanel({
  resume,
  label,
  getFamilyId,
  align = 'left',
}: UserCenterInspectorPreviewPanelProps) {
  return (
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
}
