import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/react'
import type { ResumeData } from '@/types/resume'
import { generatePdfFilename, cn } from '@/lib/utils'
import { exportResumeFile } from '@/lib/storage'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import type { Options as HtmlToImageOptions } from 'html-to-image/lib/types'
import { resumeDataToHtml, normalizeResumeDataForAvatar } from '@/components/pdf-viewer'

interface ExportButtonProps {
  resumeData: ResumeData
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  showImageOptions?: boolean // 在没有预览面板时可关闭图片导出
}

async function saveWithDialog(
  dataUrl: string,
  defaultName: string,
  filters: { name: string; extensions: string[] }[],
): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const dest = await save({ defaultPath: defaultName, filters })
  if (!dest) return false

  const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
  if (!base64Match) throw new Error('Invalid data URL format')
  const binaryStr = atob(base64Match[1])
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }

  const { writeFile } = await import('@tauri-apps/plugin-fs')
  await writeFile(dest, bytes)
  return true
}

async function saveTextWithDialog(
  content: string,
  defaultName: string,
  filters: { name: string; extensions: string[] }[],
): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const dest = await save({ defaultPath: defaultName, filters })
  if (!dest) return false

  const encoder = new TextEncoder()
  const bytes = encoder.encode(content)

  const { writeFile } = await import('@tauri-apps/plugin-fs')
  await writeFile(dest, bytes)
  return true
}

async function invokeTauriPdf(html: string, filename: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('generate_pdf', { html, filename })
}

export function ExportButton({
  resumeData,
  variant = 'default',
  size = 'default',
  className,
  showImageOptions = true,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  // 在当前页面查找可用于导出的预览节点；若不存在则临时渲染一个离屏预览
  const ensurePreviewForExport = async (): Promise<{
    sourceEl: HTMLElement
    cleanup: () => void
  }> => {
    const existing = document.querySelector('.resume-preview') as HTMLElement | null
    if (existing) {
      return { sourceEl: existing, cleanup: () => {} }
    }

    // 动态挂载一个离屏预览以支持图片导出
    const host = document.createElement('div')
    host.style.position = 'fixed'
    host.style.left = '-10000px'
    host.style.top = '-10000px'
    host.style.opacity = '0'
    host.style.pointerEvents = 'none'
    host.className = 'pdf-preview-mode' // 采用 PDF 预览尺寸，导出清晰
    document.body.appendChild(host)

    const [{ createRoot }, { default: ResumePreview }] = await Promise.all([
      import('react-dom/client'),
      import('./resume-preview'),
    ])

    const root = createRoot(host)
    root.render(React.createElement(ResumePreview, { resumeData }))

    // 等待渲染与布局生效
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))
    const source = host.querySelector('.resume-preview') as HTMLElement | null
    if (!source) {
      root.unmount()
      host.remove()
      throw new Error('无法生成预览内容用于导出')
    }

    const cleanup = () => {
      try {
        root.unmount()
      } catch {
        // unmount may throw if already unmounted
      }
      if (host.parentNode) host.parentNode.removeChild(host)
    }
    return { sourceEl: source, cleanup }
  }

  const exportAsImage = async (format: 'png' | 'jpg' | 'webp' | 'svg') => {
    setIsExporting(true)

    try {
      const { sourceEl: resumeElement, cleanup: cleanupPreview } = await ensurePreviewForExport()

      // 克隆节点并将远程图片转为 data URL，避免 canvas 污染
      const { nodeForExport, cleanup } = await prepareNodeForExport(resumeElement)
      try {
        if (format === 'svg') {
          await exportAsSVG(nodeForExport)
          return
        }

        // 动态导入 html-to-image
        const htmlToImage = await import('html-to-image')

        // 根据格式选择对应的方法
        let dataUrl: string
        const options: HtmlToImageOptions = {
          quality: format === 'jpg' ? 0.95 : 1,
          pixelRatio: 2, // 提高清晰度
          backgroundColor: '#ffffff',
          cacheBust: true,
          imagePlaceholder:
            // 1x1 透明像素，若有图片加载失败用于占位，避免抛错
            'data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
          // 关闭字体内嵌，避免 html-to-image 在解析字体时对 undefined 调用 trim 抛错
          skipFonts: true,
        }

        switch (format) {
          case 'png':
            dataUrl = await htmlToImage.toPng(nodeForExport, options)
            break
          case 'jpg':
            dataUrl = await htmlToImage.toJpeg(nodeForExport, options)
            break
          case 'webp': {
            // html-to-image 没有直接的 toWebp 方法，使用 toBlob 然后转换
            const blob = await htmlToImage.toBlob(nodeForExport, options)
            if (!blob) throw new Error('生成 WEBP 失败')
            // 浏览器支持 canvas 转 webp：将 PNG/JPEG Blob 转换为 webp
            // 若不支持，将保留原始 blob 类型
            const webpUrl = await convertBlobToFormat(blob, 'image/webp')
            dataUrl = webpUrl ?? (await blobToDataUrl(blob))
            break
          }
          default:
            throw new Error('不支持的格式')
        }

        const defaultName = generatePdfFilename(resumeData.title).replace('.pdf', `.${format}`)
        const saved = await saveWithDialog(dataUrl, defaultName, [
          { name: format.toUpperCase(), extensions: [format] },
        ])
        if (!saved) return
      } finally {
        // 移除导出时创建的克隆节点
        cleanup()
        // 若使用了离屏预览，进行清理
        cleanupPreview()
      }

      toast({
        title: '导出成功',
        description: `简历已导出为 ${format.toUpperCase()} 格式`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e || {})
      console.error('导出图片失败:', msg)
      toast({
        title: '导出失败',
        description: `导出图片时发生错误：${msg}`,
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportAsSVG = async (element: HTMLElement) => {
    try {
      // 使用 html-to-image 的 toSvg 方法
      const htmlToImage = await import('html-to-image')

      const dataUrl = await htmlToImage.toSvg(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        imagePlaceholder:
          'data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        // 同样关闭 SVG 导出时的字体内嵌，绕过 html-to-image 的字体解析 bug
        skipFonts: true,
      } as HtmlToImageOptions)

      const defaultName = generatePdfFilename(resumeData.title).replace('.pdf', '.svg')
      const saved = await saveWithDialog(dataUrl, defaultName, [
        { name: 'SVG', extensions: ['svg'] },
      ])
      if (!saved) return

      toast({
        title: '导出成功',
        description: '简历已导出为 SVG 格式',
      })
    } catch (error) {
      console.error('导出 SVG 失败:', error)
      throw error
    }
  }

  // 将节点克隆到离屏容器，并将远程图片直接 fetch 转为 data URL（Tauri 无 CORS 限制）
  async function prepareNodeForExport(
    source: HTMLElement,
  ): Promise<{ nodeForExport: HTMLElement; cleanup: () => void }> {
    const clone = source.cloneNode(true) as HTMLElement
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-10000px'
    container.style.top = '-10000px'
    container.style.opacity = '0'
    container.style.pointerEvents = 'none'
    // 固定宽高，避免在离屏容器内发生重排导致尺寸变化
    const rect = source.getBoundingClientRect()
    clone.style.width = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    container.appendChild(clone)
    document.body.appendChild(container)

    const imgs = Array.from(clone.querySelectorAll<HTMLImageElement>('img'))

    // 在 Tauri 中无 CORS 限制，直接 fetch 远程图片并转为 data URL
    for (const img of imgs) {
      const src = img.getAttribute('src') || ''
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue
      if (!/^https?:\/\//i.test(src)) continue

      try {
        const resp = await fetch(src)
        const blob = await resp.blob()
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
        img.setAttribute('src', dataUrl)
      } catch (imgErr) {
        console.warn('Failed to convert image to data URL:', imgErr)
      }
      img.removeAttribute('crossorigin')
    }

    // 等待图片加载，最多等待 5 秒
    await waitForImages(imgs, 5000)

    const cleanup = () => {
      if (container.parentNode) container.parentNode.removeChild(container)
    }
    return { nodeForExport: clone, cleanup }
  }

  function waitForImages(images: HTMLImageElement[], timeout = 5000) {
    const pending = images.filter((img) => !img.complete || img.naturalWidth === 0)
    if (pending.length === 0) return Promise.resolve()
    return new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (!done) {
          done = true
          resolve()
        }
      }
      const t = window.setTimeout(finish, timeout)
      let remaining = pending.length
      const onLoad = () => {
        remaining -= 1
        if (remaining <= 0) {
          window.clearTimeout(t)
          finish()
        }
      }
      for (const img of pending) {
        img.addEventListener('load', onLoad, { once: true })
        img.addEventListener('error', onLoad, { once: true })
      }
    })
  }

  async function convertBlobToFormat(blob: Blob, mime: string): Promise<string | null> {
    try {
      if (!('createImageBitmap' in window)) return null
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(bmp, 0, 0)
      const dataUrl = canvas.toDataURL(mime)
      try {
        bmp.close()
      } catch {
        // bmp.close() may not be supported in all browsers
      }
      return dataUrl && dataUrl.startsWith('data:') ? dataUrl : null
    } catch {
      return null
    }
  }

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to convert blob to data URL'))
      reader.readAsDataURL(blob)
    })
  }

  const exportAsPDF = async () => {
    setIsExporting(true)
    try {
      const normalized = normalizeResumeDataForAvatar(resumeData)
      const html = await resumeDataToHtml(normalized)
      const filename = generatePdfFilename(normalized.title || '')

      const pdfPath = await invokeTauriPdf(html, filename)

      const { save } = await import('@tauri-apps/plugin-dialog')
      const dest = await save({
        defaultPath: pdfPath.split('/').pop() || filename,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (!dest) return

      const { copyFile } = await import('@tauri-apps/plugin-fs')
      await copyFile(pdfPath, dest)

      toast({ title: '导出成功', description: '简历已导出为 PDF 格式' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e || {})
      console.error('导出 PDF 失败:', msg)
      toast({
        title: '导出失败',
        description: `导出 PDF 时发生错误：${msg}`,
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportAsJSON = async () => {
    try {
      const fileContent = await exportResumeFile(resumeData)
      const filename = generatePdfFilename(resumeData.title || '').replace('.pdf', '.json')
      const saved = await saveTextWithDialog(fileContent, filename, [
        { name: 'JSON', extensions: ['json'] },
      ])
      if (!saved) return

      toast({
        title: '导出成功',
        description: `简历已导出为 JSON 格式`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e || {})
      console.error('导出 JSON 失败:', msg)
      toast({
        title: '导出失败',
        description: `导出 JSON 时发生错误：${msg}`,
        variant: 'destructive',
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isExporting}
          className={cn(
            'gap-2',
            className,
            variant === 'default' ? 'bg-green-600 text-white hover:bg-green-700' : undefined,
          )}
        >
          <Icon icon="mdi:download" className="h-4 w-4" />
          {isExporting ? '导出中...' : '导出'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportAsPDF}>
          <Icon icon="mdi:file-pdf-box" className="mr-2 h-4 w-4" />
          PDF 格式
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsJSON}>
          <Icon icon="mdi:code-json" className="mr-2 h-4 w-4" />
          JSON 格式
        </DropdownMenuItem>
        {showImageOptions && (
          <>
            <DropdownMenuItem onClick={() => exportAsImage('png')}>
              <Icon icon="mdi:file-image" className="mr-2 h-4 w-4" />
              PNG 格式
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAsImage('jpg')}>
              <Icon icon="mdi:file-jpg-box" className="mr-2 h-4 w-4" />
              JPG 格式
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAsImage('webp')}>
              <Icon icon="mdi:file-image" className="mr-2 h-4 w-4" />
              WEBP 格式
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAsImage('svg')}>
              <Icon icon="mdi:svg" className="mr-2 h-4 w-4" />
              SVG 格式
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ExportButton
