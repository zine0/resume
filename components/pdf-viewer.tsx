import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ResumeData } from "@/types/resume"
import { generatePdfFilename } from "@/lib/utils"
import ResumePreview from "./resume-preview"
import PdfLoading from "@/components/pdf-loading"

export type Mode = "loading" | "server" | "fallback"

export function normalizeResumeDataForAvatar(resumeData: ResumeData): ResumeData {
  const section = resumeData.personalInfoSection
  if (!section || section.avatarType !== "idPhoto") return resumeData
  if (section.avatarShape === "square") return resumeData
  return {
    ...resumeData,
    personalInfoSection: { ...section, avatarShape: "square" },
  }
}

export function resumeDataToHtml(data: ResumeData): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  body { margin: 0; font-family: 'NotoSansSC', system-ui, sans-serif; }
</style>
</head>
<body>
<div id="resume-preview-root"></div>
<script>
  window.__RESUME_DATA__ = ${JSON.stringify(data)};
</script>
</body>
</html>`
}

async function invokeTauriPdf(html: string, filename: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<string>("generate_pdf", { html, filename })
}

export function PDFViewer({
  resumeData,
  onModeChange,
  renderNotice = "internal",
}: {
  resumeData: ResumeData
  onModeChange?: (mode: Mode) => void
  renderNotice?: "internal" | "external"
}) {
  const [mode, setMode] = useState<Mode>("loading")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const normalizedResumeData = useMemo(() => normalizeResumeDataForAvatar(resumeData), [resumeData])
  const resumeKey = useMemo(() => JSON.stringify(normalizedResumeData), [normalizedResumeData])
  const genIdRef = useRef(0)

  useEffect(() => {
    let mounted = true
    let urlToRevoke: string | null = null
    const currentId = ++genIdRef.current

    const run = async () => {
      try {
        const parsed: ResumeData = JSON.parse(resumeKey)
        const html = resumeDataToHtml(parsed)
        const filename = generatePdfFilename(parsed.title || "")

        const pdfPath = await invokeTauriPdf(html, filename)
        if (!mounted || genIdRef.current !== currentId) return

        setPdfUrl(pdfPath)
        setMode("server")
        onModeChange?.("server")
      } catch (e) {
        console.error("Tauri PDF failed, falling back to print:", e)
        if (!mounted || genIdRef.current !== currentId) return
        setError(e instanceof Error ? e.message : String(e))
        setMode("fallback")
        onModeChange?.("fallback")
      }
    }

    const t = setTimeout(run, 150)
    return () => {
      mounted = false
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke)
      clearTimeout(t)
    }
  }, [resumeKey, onModeChange, renderNotice])

  if (mode === "server") {
    if (renderNotice === "external") {
      return <PdfLoading message="正在打开 PDF..." />
    }
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-sm text-muted-foreground mb-3">PDF 已生成</p>
          <p className="text-xs text-muted-foreground break-all">{pdfUrl}</p>
        </div>
      </div>
    )
  }

  if (mode === "loading") {
    return <PdfLoading />
  }

  return (
    <div className="w-full h-full pdf-fallback-container">
      {renderNotice === "internal" && (
        <div className="no-print p-3 border-b bg-white">
          <div className="text-sm text-muted-foreground">
            {error ? (
              <span>Tauri PDF 生成失败，已切换为浏览器打印。{error}</span>
            ) : (
              <span>已切换为浏览器打印。</span>
            )}
            <span className="ml-2 text-foreground">请在打印对话框中：关闭"页眉和页脚"，勾选"背景图形"。</span>
            <button
              onClick={() => window.print()}
              className="ml-3 inline-flex items-center px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm"
            >
              打印
            </button>
          </div>
        </div>
      )}
      <div className="pdf-preview-mode">
        <ResumePreview resumeData={normalizedResumeData} />
      </div>
    </div>
  )
}

export function PDFDownloadLink({
  resumeData,
  fileName = "resume.pdf",
  children,
}: {
  resumeData: ResumeData
  fileName?: string
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      if (loading) return
      setLoading(true)
      const normalized = normalizeResumeDataForAvatar(resumeData)
      try {
        const html = resumeDataToHtml(normalized)
        const pdfPath = await invokeTauriPdf(html, fileName)
        const { save } = await import("@tauri-apps/plugin-dialog")
        const dest = await save({ defaultPath: pdfPath.split("/").pop() || fileName, filters: [{ name: "PDF", extensions: ["pdf"] }] })
        if (!dest) return
        const { copyFile } = await import("@tauri-apps/plugin-fs")
        await copyFile(pdfPath, dest)
      } catch (e) {
        console.error(e)
        alert("生成 PDF 失败，请稍后再试。")
      } finally {
        setLoading(false)
      }
    },
    [resumeData, fileName, loading]
  )

  if (React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void; disabled?: boolean }>
    return React.cloneElement(child, { onClick: handleClick, disabled: loading || child.props.disabled })
  }
  return (
    <a href="#" onClick={handleClick}>
      {loading ? "正在生成 PDF..." : children || "下载 PDF"}
    </a>
  )
}

export default PDFViewer
