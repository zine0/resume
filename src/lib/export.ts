import { invoke } from '@tauri-apps/api/core'

export interface ExportFileFilter {
  name: string
  extensions: string[]
}

export type PdfExportErrorCode =
  | 'TEMP_FILE'
  | 'BROWSER_LAUNCH'
  | 'TAB_CREATE'
  | 'NAVIGATION'
  | 'PAGE_LOAD'
  | 'PRINT'
  | 'APP_DATA_DIR'
  | 'OUTPUT_DIR'
  | 'SAVE_FILE'
  | 'UNKNOWN'

const PDF_ERROR_PREFIX = 'PDF_ERROR::'

const PDF_ERROR_MESSAGES: Record<PdfExportErrorCode, string> = {
  TEMP_FILE: '准备 PDF 临时文件失败',
  BROWSER_LAUNCH: '启动 PDF 渲染器失败',
  TAB_CREATE: '创建 PDF 渲染页面失败',
  NAVIGATION: '加载 PDF 渲染页面失败',
  PAGE_LOAD: '等待 PDF 页面渲染完成失败',
  PRINT: '生成 PDF 内容失败',
  APP_DATA_DIR: '定位 PDF 输出目录失败',
  OUTPUT_DIR: '创建 PDF 输出目录失败',
  SAVE_FILE: '写入 PDF 文件失败',
  UNKNOWN: '生成 PDF 失败，请稍后再试。',
}

export class PdfExportError extends Error {
  code: PdfExportErrorCode
  detail: string

  constructor(code: PdfExportErrorCode, detail: string) {
    super(PDF_ERROR_MESSAGES[code])
    this.code = code
    this.detail = detail
    this.name = 'PdfExportError'
  }
}

function parsePdfExportError(error: unknown): PdfExportError {
  const rawMessage = error instanceof Error ? error.message : String(error)

  if (rawMessage.startsWith(PDF_ERROR_PREFIX)) {
    const [, rawCode = 'UNKNOWN', ...rest] = rawMessage.split('::')
    const code = (rawCode in PDF_ERROR_MESSAGES ? rawCode : 'UNKNOWN') as PdfExportErrorCode
    const detail = rest.join('::') || rawMessage
    return new PdfExportError(code, detail)
  }

  return new PdfExportError('UNKNOWN', rawMessage)
}

function getPathBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments[segments.length - 1] || path
}

async function saveBytesWithDialog(
  bytes: Uint8Array,
  defaultName: string,
  filters: ExportFileFilter[],
): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const dest = await save({ defaultPath: defaultName, filters })
  if (!dest) return false

  const { writeFile } = await import('@tauri-apps/plugin-fs')
  await writeFile(dest, bytes)
  return true
}

export async function saveDataUrlWithDialog(
  dataUrl: string,
  defaultName: string,
  filters: ExportFileFilter[],
): Promise<boolean> {
  const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
  if (!base64Match) throw new Error('Invalid data URL format')

  const binaryStr = atob(base64Match[1])
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }

  return saveBytesWithDialog(bytes, defaultName, filters)
}

export async function saveTextWithDialog(
  content: string,
  defaultName: string,
  filters: ExportFileFilter[],
): Promise<boolean> {
  const encoder = new TextEncoder()
  return saveBytesWithDialog(encoder.encode(content), defaultName, filters)
}

export async function generatePdfViaTauri(html: string, filename: string): Promise<string> {
  try {
    return await invoke<string>('generate_pdf', { html, filename })
  } catch (error) {
    throw parsePdfExportError(error)
  }
}

export async function saveGeneratedPdfWithDialog(
  pdfPath: string,
  defaultName: string,
): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const dest = await save({
    defaultPath: getPathBasename(pdfPath) || defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!dest) return false

  const { copyFile } = await import('@tauri-apps/plugin-fs')
  await copyFile(pdfPath, dest)
  return true
}

export function getPdfExportErrorMessage(error: unknown): string {
  if (error instanceof PdfExportError) {
    return error.message
  }

  if (error instanceof Error) {
    if (error.message.startsWith(PDF_ERROR_PREFIX)) {
      return parsePdfExportError(error).message
    }

    return error.message
  }

  return PDF_ERROR_MESSAGES.UNKNOWN
}
