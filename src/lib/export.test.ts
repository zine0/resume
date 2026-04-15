import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PdfExportError,
  getPdfExportErrorMessage,
  saveDataUrlWithDialog,
  generatePdfViaTauri,
} from '@/lib/export'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
  copyFile: vi.fn(),
}))

describe('PdfExportError', () => {
  it('sets code, detail, message and name from constructor', () => {
    const err = new PdfExportError('BROWSER_LAUNCH', 'chrome not found')
    expect(err.code).toBe('BROWSER_LAUNCH')
    expect(err.detail).toBe('chrome not found')
    expect(err.message).toBe('启动 PDF 渲染器失败')
    expect(err.name).toBe('PdfExportError')
  })

  it('uses UNKNOWN message for unknown codes', () => {
    const err = new PdfExportError('UNKNOWN', 'something broke')
    expect(err.message).toBe('生成 PDF 失败，请稍后再试。')
  })
})

describe('getPdfExportErrorMessage', () => {
  it('returns Chinese message for PdfExportError instances', () => {
    const err = new PdfExportError('PRINT', 'timeout')
    expect(getPdfExportErrorMessage(err)).toBe('生成 PDF 内容失败')
  })

  it('parses PDF_ERROR::CODE::detail string into correct message', () => {
    const err = new Error('PDF_ERROR::SAVE_FILE::disk full')
    expect(getPdfExportErrorMessage(err)).toBe('写入 PDF 文件失败')
  })

  it('returns UNKNOWN message for unrecognized error codes', () => {
    const err = new Error('PDF_ERROR::FANCY_NEW_CODE::details')
    expect(getPdfExportErrorMessage(err)).toBe('生成 PDF 失败，请稍后再试。')
  })

  it('returns unknown message for non-PDF errors (plain Error)', () => {
    const err = new Error('something went wrong')
    expect(getPdfExportErrorMessage(err)).toBe('something went wrong')
  })

  it('returns UNKNOWN message for non-Error values', () => {
    expect(getPdfExportErrorMessage('random string')).toBe('生成 PDF 失败，请稍后再试。')
  })

  it('returns UNKNOWN message for null', () => {
    expect(getPdfExportErrorMessage(null)).toBe('生成 PDF 失败，请稍后再试。')
  })
})

describe('generatePdfViaTauri', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns path on success', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue('/tmp/output.pdf')

    const result = await generatePdfViaTauri('<html></html>', 'test.pdf')
    expect(result).toBe('/tmp/output.pdf')
  })

  it('throws PdfExportError on invoke failure', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockRejectedValue(new Error('PDF_ERROR::TEMP_FILE::write failed'))

    await expect(generatePdfViaTauri('<html></html>', 'test.pdf')).rejects.toThrow(PdfExportError)
  })

  it('maps unknown invoke errors to UNKNOWN code', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockRejectedValue('some string error')

    try {
      await generatePdfViaTauri('<html></html>', 'test.pdf')
    } catch (e) {
      expect(e).toBeInstanceOf(PdfExportError)
      expect((e as PdfExportError).code).toBe('UNKNOWN')
    }
  })
})

describe('saveDataUrlWithDialog', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws on invalid data URL format (no data: prefix)', async () => {
    await expect(saveDataUrlWithDialog('not-a-data-url', 'test.png', [])).rejects.toThrow(
      'Invalid data URL format',
    )
  })

  it('throws on non-base64 data URL', async () => {
    await expect(saveDataUrlWithDialog('data:text/plain,hello', 'test.txt', [])).rejects.toThrow(
      'Invalid data URL format',
    )
  })

  it('converts base64 data URL to bytes and saves', async () => {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')

    vi.mocked(save).mockResolvedValue('/tmp/out.png')
    vi.mocked(writeFile).mockResolvedValue(undefined)

    // btoa('hello') = 'aGVsbG8='
    const result = await saveDataUrlWithDialog('data:image/png;base64,aGVsbG8=', 'test.png', [
      { name: 'Image', extensions: ['png'] },
    ])

    expect(result).toBe(true)
    expect(save).toHaveBeenCalledWith({
      defaultPath: 'test.png',
      filters: [{ name: 'Image', extensions: ['png'] }],
    })
    expect(writeFile).toHaveBeenCalled()
  })

  it('returns false when user cancels dialog', async () => {
    const { save } = await import('@tauri-apps/plugin-dialog')
    vi.mocked(save).mockResolvedValue(null)

    const result = await saveDataUrlWithDialog('data:image/png;base64,aGVsbG8=', 'test.png', [])

    expect(result).toBe(false)
  })
})
