import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { extractSvgBody, getIconSvgMarkup } from '@/lib/icon-storage'
import { Icon } from '@iconify/react'

interface IconPickerProps {
  selectedIcon?: string
  onSelect: (icon: string) => void
}

/**
 * 常用图标列表
 */
const COMMON_ICONS = [
  // 个人信息相关
  { icon: 'mdi:account', label: '用户' },
  { icon: 'mdi:phone', label: '电话' },
  { icon: 'mdi:email', label: '邮箱' },
  { icon: 'mdi:map-marker', label: '地址' },
  { icon: 'mdi:web', label: '网站' },
  { icon: 'mdi:github', label: 'GitHub' },
  { icon: 'mdi:linkedin', label: 'LinkedIn' },
  { icon: 'mdi:wechat', label: '微信' },

  // 简历模块相关
  { icon: 'mdi:briefcase', label: '工作' },
  { icon: 'mdi:school', label: '教育' },
  { icon: 'mdi:certificate', label: '证书' },
  { icon: 'mdi:lightbulb', label: '技能' },
  { icon: 'mdi:rocket', label: '项目' },
  { icon: 'mdi:star', label: '荣誉' },
  { icon: 'mdi:heart', label: '兴趣' },
  { icon: 'mdi:account-group', label: '团队' },

  // 通用图标
  { icon: 'mdi:text-box', label: '文本' },
  { icon: 'mdi:information', label: '信息' },
  { icon: 'mdi:check-circle', label: '完成' },
  { icon: 'mdi:clock', label: '时间' },
  { icon: 'mdi:calendar', label: '日期' },
  { icon: 'mdi:flag', label: '标记' },
  { icon: 'mdi:target', label: '目标' },
  { icon: 'mdi:trophy', label: '奖杯' },
]

export const getIconSvgPath = getIconSvgMarkup

/**
 * 图标选择器组件
 */
export default function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<{ icon: string; label: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [iconSvgCache, setIconSvgCache] = useState<Record<string, string>>({})

  // 初始显示常用图标列表
  const filteredIcons = searchTerm
    ? searchResults
    : COMMON_ICONS.filter(
        ({ icon, label }) =>
          icon.toLowerCase().includes(searchTerm.toLowerCase()) ||
          label.toLowerCase().includes(searchTerm.toLowerCase()),
      )

  // 使用Iconify API搜索图标
  useEffect(() => {
    const searchIcons = async () => {
      if (!searchTerm || searchTerm.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await fetch(
          `https://api.iconify.design/search?query=${encodeURIComponent(searchTerm)}&limit=24`,
        )
        const data = await response.json()

        if (data && data.icons) {
          const results = data.icons.map((icon: string) => ({
            icon,
            label: icon.split(':')[1] || icon,
          }))
          setSearchResults(results)
        }
      } catch (error) {
        console.error('搜索图标失败:', error)
      } finally {
        setIsSearching(false)
      }
    }

    const timer = setTimeout(() => {
      searchIcons()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    const missingIcons = filteredIcons
      .filter(({ icon }) => !iconSvgCache[icon])
      .map(({ icon }) => icon)
    if (missingIcons.length === 0) return

    let cancelled = false

    Promise.all(
      missingIcons.map(async (icon) => {
        const svg = await getIconSvgPath(icon)
        return svg ? [icon, svg] : null
      }),
    ).then((results) => {
      if (cancelled) return
      setIconSvgCache((prev) => {
        const next = { ...prev }
        let changed = false
        for (const entry of results) {
          if (!entry) continue
          const [icon, svg] = entry
          if (next[icon] !== svg) {
            next[icon] = svg
            changed = true
          }
        }
        return changed ? next : prev
      })
    })

    return () => {
      cancelled = true
    }
  }, [filteredIcons, iconSvgCache])

  const isSelectedIcon = (icon: string) => {
    if (!selectedIcon) return false
    const cachedIcon = iconSvgCache[icon]
    return (
      selectedIcon === icon ||
      selectedIcon === cachedIcon ||
      (cachedIcon ? selectedIcon === extractSvgBody(cachedIcon) : false)
    )
  }

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <Input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="搜索图标..."
        aria-label="搜索图标"
        className="w-full"
      />

      {/* 图标网格 */}
      <ScrollArea className="h-64">
        <div className="grid grid-cols-6 gap-2 p-1">
          {/* 空选项 */}
          <Button
            key="empty-icon"
            variant={!selectedIcon ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelect('')}
            className="flex h-12 w-12 flex-col items-center justify-center gap-1 p-0"
            title="不使用图标"
            aria-label="不使用图标"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-sm border border-dashed border-gray-400">
              <span className="text-xs text-gray-400">无</span>
            </div>
          </Button>

          {/* 图标列表 */}
          {filteredIcons.map(({ icon, label }) => (
            <Button
              key={icon}
              variant={isSelectedIcon(icon) ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                getIconSvgPath(icon).then((svgPath) => {
                  if (svgPath) onSelect(svgPath)
                })
              }}
              className="flex h-12 w-12 flex-col items-center justify-center gap-1 p-0"
              title={label}
              aria-label={`选择图标：${label}`}
            >
              <Icon icon={icon} className="h-5 w-5" />
            </Button>
          ))}

          {/* 搜索状态 */}
          {isSearching && (
            <div className="col-span-6 py-4 text-center text-sm text-gray-500">正在搜索图标...</div>
          )}

          {/* 空搜索结果 */}
          {searchTerm && !isSearching && searchResults.length === 0 && (
            <div className="col-span-6 py-4 text-center text-sm text-gray-500">
              未找到匹配的图标
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
