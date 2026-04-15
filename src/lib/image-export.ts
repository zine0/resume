export function waitForImages(images: HTMLImageElement[], timeout = 5000) {
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

export async function convertBlobToFormat(blob: Blob, mime: string): Promise<string | null> {
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

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'))
    reader.readAsDataURL(blob)
  })
}
