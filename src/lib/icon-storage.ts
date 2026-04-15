import { getIconData, iconToSVG } from '@iconify/utils'
import type { ResumeData, StoredResume } from '@/types/resume'

const iconSvgCache = new Map<string, Promise<string | null>>()

export function extractSvgBody(svg: string): string {
  const match = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  return match?.[1]?.trim() || svg.trim()
}

export async function getIconSvgMarkup(iconName: string): Promise<string | null> {
  if (!iconName) return null

  const normalized = iconName.trim()
  if (!normalized) return null

  const cached = iconSvgCache.get(normalized)
  if (cached) return cached

  const pending = (async () => {
    const [prefix, name] = normalized.split(':')
    if (!prefix || !name) return null

    try {
      const response = await fetch(`https://api.iconify.design/${prefix}.json?icons=${name}`)
      const data = await response.json()

      if (!data?.icons?.[name]) {
        return null
      }

      const iconData = getIconData(data, name)
      if (!iconData) return null

      const svg = iconToSVG(iconData, { height: 'auto' })
      const attrs = Object.entries(svg.attributes)
        .map(([key, value]) => `${key}="${String(value)}"`)
        .join(' ')

      return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${svg.body}</svg>`
    } catch (error) {
      console.error('获取图标 SVG 失败:', error)
      return null
    }
  })()

  iconSvgCache.set(normalized, pending)
  return pending
}

export async function normalizeStoredIconValue(icon?: string): Promise<string | undefined> {
  const normalized = icon?.trim()
  if (!normalized) return undefined
  if (normalized.startsWith('<')) return normalized
  if (!normalized.includes(':')) return normalized

  const svg = await getIconSvgMarkup(normalized)
  return svg ?? normalized
}

export async function normalizeResumeDataIcons(data: ResumeData): Promise<ResumeData> {
  const personalInfo = await Promise.all(
    data.personalInfoSection.personalInfo.map(async (item) => ({
      ...item,
      icon: await normalizeStoredIconValue(item.icon),
    })),
  )

  const modules = await Promise.all(
    data.modules.map(async (module) => ({
      ...module,
      icon: await normalizeStoredIconValue(module.icon),
    })),
  )

  return {
    ...data,
    personalInfoSection: {
      ...data.personalInfoSection,
      personalInfo,
    },
    modules,
  }
}

export async function normalizeStoredResumeIcons(entry: StoredResume): Promise<StoredResume> {
  return {
    ...entry,
    resumeData: await normalizeResumeDataIcons(entry.resumeData),
  }
}
