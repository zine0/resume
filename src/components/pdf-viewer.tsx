import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  generatePdfViaTauri,
  getPdfExportErrorMessage,
  saveGeneratedPdfWithDialog,
} from '@/lib/export'
import type { ResumeData } from '@/types/resume'
import { generatePdfFilename } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import ResumePreview from './resume-preview'
import PdfLoading from '@/components/pdf-loading'

export type Mode = 'loading' | 'server' | 'fallback'

const NOTO_SANS_SC_FAMILY = 'Noto Sans SC'
const NOTO_SANS_SC_PATH = '/NotoSansSC-Medium.ttf'

let embeddedNotoSansScDataUrlPromise: Promise<string> | null = null

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to read font data URL'))
    }
    reader.onerror = () => reject(new Error('Failed to load embedded font'))
    reader.readAsDataURL(blob)
  })
}

async function getEmbeddedNotoSansScDataUrl(): Promise<string> {
  if (!embeddedNotoSansScDataUrlPromise) {
    embeddedNotoSansScDataUrlPromise = fetch(NOTO_SANS_SC_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load local font: ${response.status}`)
        }
        return response.blob()
      })
      .then(blobToDataUrl)
      .catch((error) => {
        embeddedNotoSansScDataUrlPromise = null
        throw error
      })
  }

  return embeddedNotoSansScDataUrlPromise
}

function collectDocumentStyles(): string {
  const collected: string[] = []

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules
      if (!rules.length) continue

      const cssText = Array.from(rules)
        .map((rule) => rule.cssText)
        .join('\n')

      if (cssText.trim()) {
        collected.push(cssText)
      }
    } catch {
      // Ignore stylesheets whose rules are not readable in the current environment
    }
  }

  return collected.join('\n')
}

async function renderResumePreviewHtml(data: ResumeData): Promise<string> {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '-10000px'
  host.style.opacity = '0'
  host.style.pointerEvents = 'none'
  host.className = 'pdf-preview-mode'
  document.body.appendChild(host)

  const [{ createRoot }, { flushSync }] = await Promise.all([
    import('react-dom/client'),
    import('react-dom'),
  ])

  const root = createRoot(host)

  try {
    flushSync(() => {
      root.render(<ResumePreview resumeData={data} />)
    })

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })

    const anyDoc = document as Document & { fonts?: { ready?: Promise<unknown> } }
    if (anyDoc.fonts?.ready) {
      await anyDoc.fonts.ready
    }

    const preview = host.querySelector('.resume-preview')
    if (!preview) {
      throw new Error('Failed to render resume preview HTML')
    }

    return `<div class="pdf-preview-mode">${preview.outerHTML}</div>`
  } finally {
    root.unmount()
    host.remove()
  }
}

export function normalizeResumeDataForAvatar(resumeData: ResumeData): ResumeData {
  const section = resumeData.personalInfoSection
  if (!section || section.avatarType !== 'idPhoto') return resumeData
  if (section.avatarShape === 'square') return resumeData
  return {
    ...resumeData,
    personalInfoSection: { ...section, avatarShape: 'square' },
  }
}

export async function resumeDataToHtml(data: ResumeData): Promise<string> {
  const [fontDataUrl, previewHtml] = await Promise.all([
    getEmbeddedNotoSansScDataUrl(),
    renderResumePreviewHtml(data),
  ])
  const inlineStyles = collectDocumentStyles()

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @font-face {
    font-family: '${NOTO_SANS_SC_FAMILY}';
    src: url('${fontDataUrl}') format('truetype');
    font-weight: 400;
    font-style: normal;
  }

  html, body {
    margin: 0;
    font-family: '${NOTO_SANS_SC_FAMILY}', system-ui, sans-serif;
  }

  ${inlineStyles}
</style>
</head>
<body>
${previewHtml}
</body>
</html>`
}

export function PDFViewer({
  resumeData,
  onModeChange,
  renderNotice = 'internal',
}: {
  resumeData: ResumeData
  onModeChange?: (mode: Mode) => void
  renderNotice?: 'internal' | 'external'
}) {
  const [mode, setMode] = useState<Mode>('loading')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const normalizedResumeData = useMemo(() => normalizeResumeDataForAvatar(resumeData), [resumeData])
  const resumeKey = useMemo(() => JSON.stringify(normalizedResumeData), [normalizedResumeData])
  const genIdRef = useRef(0)

  useEffect(() => {
    let mounted = true
    const urlToRevoke: string | null = null
    const currentId = ++genIdRef.current

    const run = async () => {
      try {
        const parsed: ResumeData = JSON.parse(resumeKey)
        const html = await resumeDataToHtml(parsed)
        const filename = generatePdfFilename(parsed.title || '')

        const pdfPath = await generatePdfViaTauri(html, filename)
        if (!mounted || genIdRef.current !== currentId) return

        setPdfUrl(pdfPath)
        setMode('server')
        onModeChange?.('server')
      } catch (e) {
        console.error('Tauri PDF failed, falling back to print:', e)
        if (!mounted || genIdRef.current !== currentId) return
        setError(getPdfExportErrorMessage(e))
        setMode('fallback')
        onModeChange?.('fallback')
      }
    }

    const t = setTimeout(run, 150)
    return () => {
      mounted = false
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke)
      clearTimeout(t)
    }
  }, [resumeKey, onModeChange])

  if (mode === 'server') {
    if (renderNotice === 'external') {
      return <PdfLoading message="正在打开 PDF..." />
    }
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-3 text-sm">PDF 已生成</p>
          <p className="text-muted-foreground text-xs break-all">{pdfUrl}</p>
        </div>
      </div>
    )
  }

  if (mode === 'loading') {
    return <PdfLoading />
  }

  return (
    <div className="pdf-fallback-container h-full w-full">
      {renderNotice === 'internal' && (
        <div className="no-print border-b bg-white p-3">
          <div className="text-muted-foreground text-sm">
            {error ? (
              <span>Tauri PDF 生成失败，已切换为浏览器打印。{error}</span>
            ) : (
              <span>已切换为浏览器打印。</span>
            )}
            <span className="text-foreground ml-2">
              请在打印对话框中：关闭"页眉和页脚"，勾选"背景图形"。
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-primary text-primary-foreground ml-3 inline-flex items-center rounded px-3 py-1.5 text-sm"
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
  fileName = 'resume.pdf',
  children,
}: {
  resumeData: ResumeData
  fileName?: string
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      if (loading) return
      setLoading(true)
      const normalized = normalizeResumeDataForAvatar(resumeData)
      try {
        const html = await resumeDataToHtml(normalized)
        const pdfPath = await generatePdfViaTauri(html, fileName)
        const saved = await saveGeneratedPdfWithDialog(pdfPath, fileName)
        if (!saved) return
      } catch (e) {
        console.error(e)
        const description = getPdfExportErrorMessage(e)
        toast({
          title: '生成 PDF 失败',
          description,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [resumeData, fileName, loading, toast],
  )

  if (React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      onClick?: (e: React.MouseEvent) => void
      disabled?: boolean
    }>
    return React.cloneElement(child, {
      onClick: handleClick,
      disabled: loading || child.props.disabled,
    })
  }
  return (
    <button type="button" onClick={handleClick}>
      {loading ? '正在生成 PDF...' : children || '下载 PDF'}
    </button>
  )
}

export default PDFViewer
