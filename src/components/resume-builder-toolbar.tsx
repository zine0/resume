import { Icon } from '@iconify/react'
import ExportButton from '@/components/export-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { AutoSaveStatus } from '@/hooks/use-auto-save'
import type { ResumeData } from '@/types/resume'

type ViewMode = 'both' | 'edit-only' | 'preview-only'

interface ResumeBuilderToolbarProps {
  title: string
  resumeData: ResumeData
  viewMode: ViewMode
  autoSaveStatus?: AutoSaveStatus
  autoSaveLastSaved?: string | null
  autoSaveErrorMessage?: string | null
  onViewModeChange: (mode: ViewMode) => void
  onBack?: () => void
  onSave?: (data: ResumeData) => void | Promise<void>
  onOpenFullOptimize: () => void
  onOpenJdAnalysis: () => void
}

export function ResumeBuilderToolbar({
  title,
  resumeData,
  viewMode,
  autoSaveStatus,
  autoSaveLastSaved,
  autoSaveErrorMessage,
  onViewModeChange,
  onBack,
  onSave,
  onOpenFullOptimize,
  onOpenJdAnalysis,
}: ResumeBuilderToolbarProps) {
  return (
    <div className="editor-toolbar no-print">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:file-document-edit" className="text-primary h-6 w-6" />
          <h1 className="text-lg font-semibold">简历编辑器</h1>
        </div>
        <Badge variant="secondary" className="text-xs">
          {title}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {onBack ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBack()}
            className="gap-2 bg-transparent"
          >
            <Icon icon="mdi:arrow-left" className="h-4 w-4" />
            返回
          </Button>
        ) : null}

        <Separator orientation="vertical" className="h-6" />

        <div className="bg-muted relative inline-flex rounded-lg p-1">
          {[
            { key: 'both' as const, label: '编辑+预览', icon: 'mdi:view-split-vertical' },
            { key: 'edit-only' as const, label: '仅编辑', icon: 'mdi:pencil' },
            { key: 'preview-only' as const, label: '仅预览', icon: 'mdi:eye' },
          ].map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => onViewModeChange(mode.key)}
              className={`relative flex min-w-[100px] items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                viewMode === mode.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              } `}
            >
              <Icon icon={mode.icon} className="h-4 w-4" />
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          ))}
        </div>

        {onSave ? (
          <Button
            size="sm"
            onClick={() => onSave(resumeData)}
            className="gap-2 bg-green-600 text-white hover:bg-green-700"
          >
            <Icon icon="mdi:content-save" className="h-4 w-4" />
            保存
          </Button>
        ) : null}

        {autoSaveStatus && autoSaveStatus !== 'idle' && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {autoSaveStatus === 'saving' && (
              <>
                <Icon icon="mdi:loading" className="h-3 w-3 animate-spin" />
                保存中...
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <Icon icon="mdi:check-circle" className="h-3 w-3 text-green-500" />
                已保存{autoSaveLastSaved ? ` ${autoSaveLastSaved}` : ''}
              </>
            )}
            {autoSaveStatus === 'error' && (
              <>
                <Icon icon="mdi:alert-circle" className="text-destructive h-3 w-3" />
                自动保存失败{autoSaveErrorMessage ? `：${autoSaveErrorMessage}` : ''}
              </>
            )}
          </span>
        )}

        <ExportButton resumeData={resumeData} size="sm" />

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFullOptimize}
          className="gap-2 bg-transparent"
        >
          <Icon icon="mdi:sparkles" className="h-4 w-4" />
          一键优化
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenJdAnalysis}
          className="gap-2 bg-transparent"
        >
          <Icon icon="mdi:target" className="h-4 w-4" />
          JD 匹配
        </Button>
      </div>
    </div>
  )
}
