import { UserCenterInspectorCompareBody } from '@/components/user-center-inspector-compare-body'
import { UserCenterInspectorDetailBody } from '@/components/user-center-inspector-detail-body'
import type {
  ResumeCompareSummary,
  ResumeInspectorMetadataItem,
  ResumeInspectorState,
} from '@/components/user-center-inspector-types'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ApplicationEntry } from '@/types/application'
import type { StoredResume } from '@/types/resume'

interface UserCenterInspectorSheetProps {
  inspector: ResumeInspectorState | null
  applicationsAvailable: boolean
  inspectorDetailResume: StoredResume | null
  inspectorDetailMetadata: ResumeInspectorMetadataItem[] | null
  inspectorDetailApplications: ApplicationEntry[]
  inspectorDetailSourceApplication: ApplicationEntry | null
  inspectorDetailLatestApplication: ApplicationEntry | null
  inspectorCompareResumes: { left: StoredResume | null; right: StoredResume | null } | null
  inspectorCompareSummary: ResumeCompareSummary | null
  onOpenChange: (open: boolean) => void
  formatInspectorTime: (value: string) => string
  formatApplicationDate: (value?: string, options?: Intl.DateTimeFormatOptions) => string
  formatApplicationStatusSummary: (applications: ApplicationEntry[]) => string
  getFamilyId: (item: StoredResume) => string
  getPersonalInfoCount: (resume: StoredResume) => number
}

export function UserCenterInspectorSheet({
  inspector,
  applicationsAvailable,
  inspectorDetailResume,
  inspectorDetailMetadata,
  inspectorDetailApplications,
  inspectorDetailSourceApplication,
  inspectorDetailLatestApplication,
  inspectorCompareResumes,
  inspectorCompareSummary,
  onOpenChange,
  formatInspectorTime,
  formatApplicationDate,
  formatApplicationStatusSummary,
  getFamilyId,
  getPersonalInfoCount,
}: UserCenterInspectorSheetProps) {
  return (
    <Sheet open={inspector !== null} onOpenChange={onOpenChange}>
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
            <UserCenterInspectorDetailBody
              applicationsAvailable={applicationsAvailable}
              resume={inspectorDetailResume}
              metadata={inspectorDetailMetadata}
              applications={inspectorDetailApplications}
              sourceApplication={inspectorDetailSourceApplication}
              latestApplication={inspectorDetailLatestApplication}
              formatInspectorTime={formatInspectorTime}
              formatApplicationDate={formatApplicationDate}
              formatApplicationStatusSummary={formatApplicationStatusSummary}
              getFamilyId={getFamilyId}
            />
          ) : null}

          {inspector?.mode === 'compare' && inspectorCompareResumes ? (
            <UserCenterInspectorCompareBody
              inspector={inspector}
              resumes={inspectorCompareResumes}
              summary={inspectorCompareSummary}
              getFamilyId={getFamilyId}
              getPersonalInfoCount={getPersonalInfoCount}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
