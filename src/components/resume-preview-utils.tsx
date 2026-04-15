import DOMPurify from 'dompurify'

export interface StoredIconShape {
  body: string
  viewBox: string
}

export function parseStoredIcon(icon?: string): StoredIconShape | null {
  if (!icon) return null
  const trimmed = icon.trim()
  if (!trimmed) return null

  const svgMatch = trimmed.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i)
  if (!svgMatch) {
    return {
      body: trimmed,
      viewBox: '0 0 24 24',
    }
  }

  const attrs = svgMatch[1] ?? ''
  const body = svgMatch[2]?.trim() ?? ''
  const viewBoxMatch = attrs.match(/viewBox=(['"])(.*?)\1/i)

  return {
    body,
    viewBox: viewBoxMatch?.[2] || '0 0 24 24',
  }
}

export function sanitizeStoredIcon(icon?: string): StoredIconShape | null {
  const parsed = parseStoredIcon(icon)
  if (!parsed?.body) return null

  const sanitizedSvg = DOMPurify.sanitize(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${parsed.viewBox}">${parsed.body}</svg>`,
    {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: [
        'path',
        'circle',
        'rect',
        'ellipse',
        'line',
        'polyline',
        'polygon',
        'g',
        'defs',
        'use',
        'clipPath',
        'mask',
        'symbol',
        'linearGradient',
        'radialGradient',
        'stop',
      ],
      ADD_ATTR: [
        'd',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-miterlimit',
        'stroke-dasharray',
        'stroke-dashoffset',
        'cx',
        'cy',
        'r',
        'x',
        'y',
        'width',
        'height',
        'viewBox',
        'points',
        'transform',
        'opacity',
        'fill-opacity',
        'stroke-opacity',
        'fill-rule',
        'clip-rule',
        'clip-path',
        'clipPathUnits',
        'mask',
        'maskUnits',
        'maskContentUnits',
        'id',
        'href',
        'xlink:href',
        'xmlns',
        'xmlns:xlink',
        'preserveAspectRatio',
        'offset',
        'stop-color',
        'stop-opacity',
        'gradientUnits',
        'gradientTransform',
      ],
    },
  )

  return parseStoredIcon(String(sanitizedSvg))
}

export function isAsciiOnly(str: string | undefined) {
  return !!str && Array.from(str).every((char) => char.charCodeAt(0) <= 0x7f)
}
