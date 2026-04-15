import { Icon } from '@iconify/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ApplicationEntry } from '@/types/application'

interface ApplicationCardProps {
  application: ApplicationEntry
  linkedResumeTitle?: string
  resumeVariantLabel?: string
  tailoring: boolean
  isDragging: boolean
  fixedWidth?: number
  style?: React.CSSProperties
  setRef: React.RefCallback<HTMLDivElement>
  dragHandle?: React.ReactNode
  previewOnly?: boolean
  movingId: string | null
  onEdit: (application: ApplicationEntry) => void
  onDelete: (application: ApplicationEntry) => void
  onTailor: (application: ApplicationEntry) => Promise<void>
  formatLooseDate: (value?: string, options?: Intl.DateTimeFormatOptions) => string
  formatDateLabel: (value: string) => string
}

export function ApplicationCard({
  application,
  linkedResumeTitle,
  resumeVariantLabel,
  tailoring,
  isDragging,
  fixedWidth,
  style,
  setRef,
  dragHandle,
  previewOnly = false,
  movingId,
  onEdit,
  onDelete,
  onTailor,
  formatLooseDate,
  formatDateLabel,
}: ApplicationCardProps) {
  const blockedReason = application.blockedReason?.trim()
  const sourceLabel = application.source?.trim()
  const resultLabel = application.result?.trim()
  const lastContactLabel = application.lastContactAt?.trim()

  return (
    <div
      ref={setRef}
      style={{
        ...style,
        ...(fixedWidth ? { width: fixedWidth } : {}),
        ...(isDragging ? { zIndex: 1100 } : {}),
      }}
      className={cn('whitespace-normal transition-transform', isDragging && 'rotate-[1deg]')}
    >
      <Card
        className={cn(
          'gap-3 p-4',
          movingId === application.id && 'opacity-70',
          isDragging && 'shadow-2xl',
          previewOnly && 'pointer-events-none',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {dragHandle ? <div className="shrink-0">{dragHandle}</div> : null}
            <div className="space-y-1">
              <p className="text-base leading-tight font-semibold">{application.company}</p>
              <p className="text-muted-foreground text-sm">{application.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {application.url ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => window.open(application.url, '_blank', 'noopener,noreferrer')}
                disabled={previewOnly}
              >
                <Icon icon="mdi:open-in-new" className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onEdit(application)}
              disabled={previewOnly}
            >
              <Icon icon="mdi:pencil-outline" className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-destructive size-8 hover:text-white"
              onClick={() => onDelete(application)}
              disabled={previewOnly}
            >
              <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {linkedResumeTitle ? (
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-primary max-w-full min-w-0 gap-1 overflow-hidden"
            >
              <span className="shrink-0">简历 ·</span>
              <span className="min-w-0 truncate">{linkedResumeTitle}</span>
            </Badge>
          ) : null}
          {resumeVariantLabel ? <Badge variant="outline">{resumeVariantLabel}</Badge> : null}
          {sourceLabel ? <Badge variant="outline">来源 {sourceLabel}</Badge> : null}
          {resultLabel ? <Badge variant="outline">结果 {resultLabel}</Badge> : null}
          {application.appliedAt ? (
            <Badge variant="outline">投递于 {application.appliedAt}</Badge>
          ) : null}
          {application.status === 'interview' && application.interviewStage ? (
            <Badge variant="outline">阶段 {application.interviewStage}</Badge>
          ) : null}
          {application.status === 'interview' && application.interviewRound ? (
            <Badge variant="outline">轮次 {application.interviewRound}</Badge>
          ) : null}
        </div>

        {blockedReason ? (
          <div className="bg-destructive/8 border-destructive/15 rounded-lg border px-3 py-2 text-sm">
            <div className="text-destructive flex items-start gap-2">
              <Icon icon="mdi:alert-octagon-outline" className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">阻塞原因</p>
                <p className="text-foreground/80">{blockedReason}</p>
              </div>
            </div>
          </div>
        ) : null}

        {application.nextAction ? (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              'border-primary/15 bg-primary/5 text-primary',
            )}
          >
            <div className="flex items-start gap-2">
              <Icon icon="mdi:arrow-right-circle-outline" className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">下一步动作</p>
                <p className="text-foreground/80">下一步：{application.nextAction}</p>
              </div>
            </div>
          </div>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 bg-transparent"
          disabled={tailoring || previewOnly}
          onClick={() => void onTailor(application)}
        >
          {tailoring ? (
            <>
              <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
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
            <p className="line-clamp-4">JD：{application.jdText}</p>
          </div>
        ) : null}

        {application.notes ? (
          <div className="bg-muted/40 rounded-lg border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
            <p className="line-clamp-4">备注：{application.notes}</p>
          </div>
        ) : null}

        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            {lastContactLabel
              ? `最近联系 ${formatLooseDate(lastContactLabel, {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : '最近暂无联系记录'}
          </span>
          <span>最近更新 {formatDateLabel(application.updatedAt)}</span>
        </div>
      </Card>
    </div>
  )
}
