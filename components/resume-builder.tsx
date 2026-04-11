
import type React from "react"

import { useState, useEffect, useCallback, memo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@iconify/react"
import type { ResumeData, EditorState } from "@/types/resume"
import { loadDefaultTemplate, loadExampleTemplate } from "@/lib/storage"
import ResumePreview from "./resume-preview"
import PersonalInfoEditor from "./personal-info-editor"
import JobIntentionEditor from "./job-intention-editor"
import ModuleEditor from "./module-editor"
import ExportButton from "./export-button"
import { AISettingsDialog } from "./ai-settings-dialog"
import JDAnalysisSheet from "./jd-analysis-sheet"
import FullResumeOptimizationDialog from "./full-resume-optimization-dialog"
import { useIsMobile } from "@/hooks/use-mobile"

type ViewMode = "both" | "edit-only" | "preview-only"

const ViewModeSelector = memo(
  ({
    viewMode,
    onViewModeChange,
  }: {
    viewMode: ViewMode
    onViewModeChange: (mode: ViewMode) => void
  }) => {
    const modes = [
      { key: "both" as ViewMode, label: "编辑+预览", icon: "mdi:view-split-vertical" },
      { key: "edit-only" as ViewMode, label: "仅编辑", icon: "mdi:pencil" },
      { key: "preview-only" as ViewMode, label: "仅预览", icon: "mdi:eye" },
    ]

    return (
      <div className="relative inline-flex bg-muted rounded-lg p-1">
        {modes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => onViewModeChange(mode.key)}
            className={`
            relative px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
            flex items-center gap-2 min-w-[100px] justify-center
            ${viewMode === mode.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
              }
          `}
          >
            <Icon icon={mode.icon} className="w-4 h-4" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        ))}
      </div>
    )
  },
)

ViewModeSelector.displayName = "ViewModeSelector"

/**
 * 简历构建器主组件
 */
export default function ResumeBuilder({
  initialData,
  template = "default",
  onChange,
  onSave,
  onBack,
  onCreateTailoredResume,
  onCreateOptimizedResume,
}: {
  initialData?: ResumeData
  template?: "default" | "example"
  onChange?: (data: ResumeData) => void
  onSave?: (data: ResumeData) => void | Promise<void>
  onBack?: () => void
  onCreateTailoredResume?: (data: ResumeData) => void | Promise<void>
  onCreateOptimizedResume?: (data: ResumeData) => void | Promise<void>
}) {
  const [editorState, setEditorState] = useState<EditorState | null>(() => {
    if (!initialData) return null
    return {
      resumeData: initialData,
      isEditing: true,
      showPreview: true,
    }
  })

  const isMobile = useIsMobile()
  const userOverridden = useRef(false)

  const [viewMode, setViewMode] = useState<ViewMode>("both")
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [jdAnalysisOpen, setJdAnalysisOpen] = useState(false)
  const [fullOptimizeOpen, setFullOptimizeOpen] = useState(false)

  useEffect(() => {
    if (userOverridden.current) return
    setViewMode(isMobile ? "edit-only" : "both")
  }, [isMobile])

  useEffect(() => {
    if (initialData) {
      setEditorState({
        resumeData: initialData,
        isEditing: true,
        showPreview: true,
      })
      return
    }

    const loadTemplate = async () => {
      const tpl = template === "example" ? await loadExampleTemplate() : await loadDefaultTemplate()
      if (!tpl) return
      setEditorState({
        resumeData: tpl,
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

  // 将变更在提交阶段通知父组件，避免在渲染中更新父组件
  useEffect(() => {
    if (!editorState) return
    onChange?.(editorState.resumeData)
  }, [editorState, onChange])

  if (!editorState) {
    return (
      <div className="resume-editor">
        <div className="editor-toolbar no-print">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
            正在加载简历模板...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="resume-editor">
      {/* 工具栏 */}
      <div className="editor-toolbar no-print">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:file-document-edit" className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold">简历编辑器</h1>
          </div>
          <Badge variant="secondary" className="text-xs">
            {editorState.resumeData.title}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* 返回置于视图模式切换左侧 */}
          {onBack ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBack?.()}
              className="gap-2 bg-transparent"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              返回
            </Button>
          ) : null}

          <Separator orientation="vertical" className="h-6" />

          <ViewModeSelector viewMode={viewMode} onViewModeChange={handleViewModeChange} />

          {/* 保存 */}
          {onSave ? (
            <Button
              size="sm"
              onClick={() => onSave?.(editorState.resumeData)}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Icon icon="mdi:content-save" className="w-4 h-4" />
              保存
            </Button>
          ) : null}

          {/* 导出 */}
          <ExportButton
            resumeData={editorState.resumeData}
            size="sm"
          />

          <Separator orientation="vertical" className="h-6" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiSettingsOpen(true)}
            className="gap-2 bg-transparent"
          >
            <Icon icon="mdi:cog-outline" className="w-4 h-4" />
            AI 设置
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFullOptimizeOpen(true)}
            className="gap-2 bg-transparent"
          >
            <Icon icon="mdi:sparkles" className="w-4 h-4" />
            一键优化
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setJdAnalysisOpen(true)}
            className="gap-2 bg-transparent"
          >
            <Icon icon="mdi:target" className="w-4 h-4" />
            JD 匹配
          </Button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="editor-content">
        {/* 编辑面板 */}
        {(viewMode === "both" || viewMode === "edit-only") && (
          <div className={`editor-panel no-print ${viewMode === "edit-only" ? "w-full" : ""}`}>
            <div className="p-6 space-y-6">
              {/* 简历标题编辑 */}
              <Card className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon icon="mdi:format-title" className="w-5 h-5 text-primary" />
                      <h2 className="font-medium">简历标题</h2>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateResumeData({ centerTitle: !editorState.resumeData.centerTitle })}
                      className="gap-2 bg-transparent"
                    >
                      <Icon icon={editorState.resumeData.centerTitle ? "mdi:format-align-center" : "mdi:format-align-left"} className="w-4 h-4" />
                      {editorState.resumeData.centerTitle ? "居中显示" : "左对齐"}
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
        )}

        {/* 预览面板 */}
        {(viewMode === "both" || viewMode === "preview-only") && (
          <div className={`preview-panel ${viewMode === "preview-only" ? "w-full" : ""}`}>
            <ResumePreview resumeData={editorState.resumeData} />
          </div>
        )}
      </div>

      <AISettingsDialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen} />
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
      />
    </div>
  )
}
