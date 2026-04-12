import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Tailwind className merge helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 下载文件到本地
 */
export function downloadFile(content: string, filename: string, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 生成PDF文件名
 */
export function generatePdfFilename(resumeTitle: string): string {
  const base = (resumeTitle || '').trim() || '未命名'
  // eslint-disable-next-line no-control-regex
  const encoded = base.replace(/[\x00-\x7F]/g, (ch) => {
    // 保留 RFC3986 中的 unreserved: ALPHA / DIGIT / "-" / "." / "_" / "~"
    if (/[A-Za-z0-9\-_.~]/.test(ch)) return ch
    // 其它 ASCII 字符进行编码（包含空格、斜杠等）
    return encodeURIComponent(ch)
  })
  const timestamp = new Date().toISOString().slice(0, 10)

  return `简历-${encoded}-${timestamp}.pdf`
}
