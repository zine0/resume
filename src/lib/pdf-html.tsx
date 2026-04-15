import type { ResumeData } from '@/types/resume'
import ResumePreview from '@/components/resume-preview'

export const NOTO_SANS_SC_FAMILY = 'Noto Sans SC'
export const NOTO_SANS_SC_PATH = '/NotoSansSC-Medium.ttf'

let embeddedNotoSansScDataUrlPromise: Promise<string> | null = null

export function blobToDataUrl(blob: Blob): Promise<string> {
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

export async function getEmbeddedNotoSansScDataUrl(): Promise<string> {
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

export function collectDocumentStyles(): string {
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

export async function renderResumePreviewHtml(data: ResumeData): Promise<string> {
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
