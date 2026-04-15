import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Icon } from '@iconify/react'
import type { ResumeData, EditorState } from '@/types/resume'
import type { AutoSaveStatus } from '@/hooks/use-auto-save'
import { normalizeResumeDataIcons } from '@/lib/icon-storage'
import { loadDefaultTemplate, loadExampleTemplate } from '@/lib/storage'
import ResumePreview from './resume-preview'
import PersonalInfoEditor from './personal-info-editor'
import JobIntentionEditor from './job-intention-editor'
import ModuleEditor from './module-editor'
import JDAnalysisSheet from './jd-analysis-sheet'
import FullResumeOptimizationDialog from './full-resume-optimization-dialog'
import { ResumeBuilderToolbar } from './resume-builder-toolbar'
import { useIsMobile } from '@/hooks/use-mobile'

type ViewMode = 'both' | 'edit-only' | 'preview-only'

/**
 * 简历构建器主组件
 */
export default function ResumeBuilder({
  initialData,
  template = 'default',
  onChange,
  onSave,
  onBack,
  onCreateTailoredResume,
  onCreateOptimizedResume,
  autoSaveStatus,
  autoSaveLastSaved,
  autoSaveErrorMessage,
}: {
  initialData?: ResumeData
  template?: 'default' | 'example'
  onChange?: (data: ResumeData) => void
  onSave?: (data: ResumeData) => void | Promise<void>
  onBack?: () => void
  onCreateTailoredResume?: (data: ResumeData) => void | Promise<void>
  onCreateOptimizedResume?: (data: ResumeData) => void | Promise<void>
  autoSaveStatus?: AutoSaveStatus
  autoSaveLastSaved?: string | null
  autoSaveErrorMessage?: string | null
}) {
  const [editorState, setEditorState] = useState<EditorState | null>(null)

  const isMobile = useIsMobile()
  const userOverridden = useRef(false)

  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const [jdAnalysisOpen, setJdAnalysisOpen] = useState(false)
  const [fullOptimizeOpen, setFullOptimizeOpen] = useState(false)

  useEffect(() => {
    if (userOverridden.current) return
    setViewMode(isMobile ? 'edit-only' : 'both')
  }, [isMobile])

  useEffect(() => {
    const loadTemplate = async () => {
      const baseData = initialData
        ? await normalizeResumeDataIcons(initialData)
        : template === 'example'
          ? await loadExampleTemplate()
          : await loadDefaultTemplate()

      if (!baseData) return

      setEditorState({
        resumeData: baseData,
        isEditing: true,
        showPreview: true,
      })
    }
    loadTemplate()
  }, [initialData, template])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    userOverridden.current = true
    setViewMode(mode)
  }, [])

  const updateResumeData = useCallback((updates: Partial<ResumeData>) => {
    setEditorState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        resumeData: {
          ...prev.resumeData,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      }
    })
  }, [])

  const handleApplySuggestion = useCallback((data: ResumeData) => {
    setEditorState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        resumeData: data,
      }
    })
  }, [])

  // 将变更在提交阶段通知父组件，避免在渲染中更新父组件
  useEffect(() => {
    if (!editorState) return
    onChange?.(editorState.resumeData)
  }, [editorState, onChange])

  if (!editorState) {
    return (
      <div className="resume-editor">
        <div className="editor-toolbar no-print">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
            正在加载简历模板...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="resume-editor">
      <ResumeBuilderToolbar
        title={editorState.resumeData.title}
        resumeData={editorState.resumeData}
        viewMode={viewMode}
        autoSaveStatus={autoSaveStatus}
        autoSaveLastSaved={autoSaveLastSaved}
        autoSaveErrorMessage={autoSaveErrorMessage}
        onViewModeChange={handleViewModeChange}
        onBack={onBack}
        onSave={onSave}
        onOpenFullOptimize={() => setFullOptimizeOpen(true)}
        onOpenJdAnalysis={() => setJdAnalysisOpen(true)}
      />

      {/* 主要内容区域 */}
      <div className="editor-content">
        {/* 编辑面板 */}
        {(viewMode === 'both' || viewMode === 'edit-only') && (
          <div
            className={`editor-panel no-print ${viewMode === 'edit-only' ? 'flex w-full justify-center' : ''}`}
          >
            <div
              className={
                viewMode === 'edit-only' ? 'h-full w-[210mm] max-w-full overflow-y-auto' : ''
              }
            >
              <div className="space-y-6 p-6">
                {/* 简历标题编辑 */}
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon icon="mdi:format-title" className="text-primary h-5 w-5" />
                        <h2 className="font-medium">简历标题</h2>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateResumeData({ centerTitle: !editorState.resumeData.centerTitle })
                        }
                        className="gap-2 bg-transparent"
                      >
                        <Icon
                          icon={
                            editorState.resumeData.centerTitle
                              ? 'mdi:format-align-center'
                              : 'mdi:format-align-left'
                          }
                          className="h-4 w-4"
                        />
                        {editorState.resumeData.centerTitle ? '居中显示' : '左对齐'}
                      </Button>
                    </div>
                    <Input
                      value={editorState.resumeData.title}
                      onChange={(e) => updateResumeData({ title: e.target.value })}
                      placeholder="请输入简历标题或姓名"
                      className="text-lg font-medium"
                    />
                  </div>
                </Card>

                {/* 求职意向编辑 */}
                <JobIntentionEditor
                  jobIntentionSection={editorState.resumeData.jobIntentionSection}
                  onUpdate={(jobIntentionSection) => updateResumeData({ jobIntentionSection })}
                />

                {/* 个人信息编辑 */}
                <PersonalInfoEditor
                  personalInfoSection={editorState.resumeData.personalInfoSection}
                  avatar={editorState.resumeData.avatar}
                  onUpdate={(personalInfoSection, avatar) => {
                    const updates: Partial<ResumeData> = { personalInfoSection }
                    if (avatar !== undefined) updates.avatar = avatar
                    updateResumeData(updates)
                  }}
                />

                {/* 简历模块编辑 */}
                <ModuleEditor
                  modules={editorState.resumeData.modules}
                  onUpdate={(modules) => updateResumeData({ modules })}
                />
              </div>
            </div>
          </div>
        )}

        {/* 预览面板 */}
        {(viewMode === 'both' || viewMode === 'preview-only') && (
          <div
            className={`preview-panel ${viewMode === 'preview-only' ? 'flex w-full justify-center p-6 md:p-8' : ''}`}
          >
            <div
              className={
                viewMode === 'preview-only'
                  ? 'min-h-full w-[210mm] max-w-full bg-white shadow-sm'
                  : ''
              }
            >
              <ResumePreview resumeData={editorState.resumeData} />
            </div>
          </div>
        )}
      </div>

      <FullResumeOptimizationDialog
        open={fullOptimizeOpen}
        onOpenChange={setFullOptimizeOpen}
        resumeData={editorState.resumeData}
        onCreateOptimizedResume={onCreateOptimizedResume}
      />
      <JDAnalysisSheet
        open={jdAnalysisOpen}
        onOpenChange={setJdAnalysisOpen}
        resumeData={editorState.resumeData}
        onCreateTailoredResume={onCreateTailoredResume}
        onApplySuggestion={handleApplySuggestion}
      />
    </div>
  )
}
