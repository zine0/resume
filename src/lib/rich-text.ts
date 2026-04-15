import type { JSONContent } from '@/types/resume'

function removeEmptyValues(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    ),
  )
}

function sanitizeMark(mark: RichTextMark): RichTextMark | null {
  if (mark.type !== 'textStyle' || !mark.attrs || typeof mark.attrs !== 'object') {
    return mark
  }

  const attrs = removeEmptyValues(mark.attrs as Record<string, unknown>)
  if (!('fontFamily' in attrs)) {
    return mark
  }

  const { fontFamily: _fontFamily, ...rest } = attrs
  const sanitizedAttrs = removeEmptyValues(rest)

  if (Object.keys(sanitizedAttrs).length === 0) {
    return null
  }

  return {
    ...mark,
    attrs: sanitizedAttrs,
  }
}

export function stripFontFamilyFromRichContent(content: JSONContent): JSONContent {
  const marks = Array.isArray(content.marks)
    ? content.marks.map(sanitizeMark).filter((mark): mark is RichTextMark => mark !== null)
    : content.marks

  const children = Array.isArray(content.content)
    ? content.content.map((child) => stripFontFamilyFromRichContent(child))
    : content.content

  return {
    ...content,
    ...(marks ? { marks } : {}),
    ...(children ? { content: children } : {}),
  }
}
import type { RichTextMark } from '@/types/resume'
