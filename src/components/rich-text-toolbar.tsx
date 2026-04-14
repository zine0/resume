import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Icon } from '@iconify/react'
import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@/types/resume'
import { useColorPicker } from '@/components/color-picker-manager'
import { useToast } from '@/hooks/use-toast'
import { getAIConfig } from '@/lib/ai-config'
import { aiPolishText } from '@/lib/ai-service'
import { jsonContentToMarkdown, markdownToRichContent } from '@/lib/markdown'
import type { PolishMode } from '@/types/ai'

// Supported fonts
const FONT_FAMILIES = [{ value: 'Noto Sans SC', label: 'Noto Sans SC' }]

// Supported font sizes
const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36]

// Preset colors
const PRESET_COLORS = [
  '#000000',
  '#666666',
  '#999999',
  '#d73a49',
  '#e36209',
  '#f9c513',
  '#28a745',
  '#0366d6',
  '#6f42c1',
  '#ea4aaa',
  '#ffffff',
]

interface RichTextToolbarProps {
  editor: Editor
}

export default function RichTextToolbar({ editor }: RichTextToolbarProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const { openColorPicker } = useColorPicker()
  const { toast } = useToast()
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null)

  // Save selection when toolbar is shown and update it whenever selection changes
  useEffect(() => {
    const updateSelection = () => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        savedSelectionRef.current = { from, to }
      }
    }

    updateSelection()
    editor.on('selectionUpdate', updateSelection)

    return () => {
      editor.off('selectionUpdate', updateSelection)
    }
  }, [editor])

  // 恢复保存的选区（防止点击工具栏导致选区丢失）
  const restoreSavedSelection = () => {
    if (savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current
      editor.chain().focus().setTextSelection({ from, to }).run()
      return true
    }
    editor.chain().focus().run()
    return false
  }

  // 将选区中的 hardBreak 拆分为独立段落，方便列表/对齐仅作用于所选行
  const splitSelectionByHardBreak = () => {
    const { state } = editor
    const { from, to } = state.selection
    const positions: number[] = []

    // 收集与当前选区相交的段落中的所有 hardBreak
    state.doc.descendants((node, pos) => {
      if (node.type?.name === 'paragraph') {
        const start = pos + 1
        const end = pos + node.nodeSize - 1
        const overlaps = !(end < from || start > to)
        if (overlaps) {
          node.descendants((child, childOffset) => {
            if (child.type?.name === 'hardBreak') {
              positions.push(start + childOffset)
            }
          })
        }
      }
    })

    if (!positions.length) return
    // 逆序处理，避免位置偏移
    positions
      .sort((a, b) => b - a)
      .forEach((pos) => {
        const c = editor.chain()
        // 先删除 hardBreak 节点
        c.setTextSelection({ from: pos, to: pos + 1 }).deleteSelection()
        // 再在该位置进行分段，避免产生空段落 + 残留 hardBreak
        c.setTextSelection({ from: pos, to: pos }).splitBlock().run()
      })
    // 大致还原选区范围
    editor
      .chain()
      .setTextSelection({
        from,
        to: Math.min(editor.state.doc.content.size - 1, to + positions.length),
      })
      .run()
  }

  // Toggle list，仅对所选行生效
  const toggleList = (type: 'bulletList' | 'orderedList') => {
    restoreSavedSelection()
    splitSelectionByHardBreak()
    const wasActive = editor.isActive(type)
    const chain = editor.chain().focus()
    if (type === 'bulletList') chain.toggleBulletList()
    else chain.toggleOrderedList()
    chain.run()
    // 保持光标在当前选择末尾，避免跳到文档末尾
    if (!wasActive && savedSelectionRef.current) {
      const { to } = savedSelectionRef.current
      editor.commands.setTextSelection(to)
    }
  }

  // Helper function to restore selection and apply color
  const applyColorWithSelection = (color: string) => {
    if (savedSelectionRef.current) {
      const { from, to } = savedSelectionRef.current
      editor.chain().focus().setTextSelection({ from, to }).setColor(color).run()
    } else {
      editor.chain().focus().setColor(color).run()
    }
  }

  // Clear formatting for current selection only
  const clearFormatting = () => {
    restoreSavedSelection()
    splitSelectionByHardBreak()
    const chain = editor.chain().focus()
    // 若处于列表，优先移除列表包装
    if (editor.isActive('bulletList')) chain.toggleBulletList()
    if (editor.isActive('orderedList')) chain.toggleOrderedList()
    // 再尝试提升 listItem，确保完全退出列表
    chain.liftListItem?.('listItem')
    // 清除段落级对齐与所有字符级样式
    chain.unsetTextAlign?.()
    chain.unsetAllMarks()
    chain.setParagraph()
    chain.run()
  }

  const handleAIPolish = async (mode: PolishMode) => {
    setAiMenuOpen(false)

    if (!savedSelectionRef.current) return
    const { from, to } = savedSelectionRef.current
    const slice = editor.state.doc.slice(from, to)
    const selectedJson = slice.toJSON() as JSONContent
    const selectedMarkdown = jsonContentToMarkdown(selectedJson)
    if (!selectedMarkdown.trim()) {
      toast({ title: '请先选择要优化的文字' })
      return
    }

    const config = await getAIConfig()
    if (!config || !config.apiKey) {
      toast({
        title: '请先配置 AI 设置',
        description: '在工具栏中点击 AI 设置按钮配置 API Key',
        variant: 'destructive',
      })
      return
    }

    setAiLoading(true)
    try {
      const result = await aiPolishText(selectedMarkdown, mode)
      restoreSavedSelection()
      const richContent = markdownToRichContent(result.text)
      editor.chain().focus().deleteSelection().insertContent(richContent).run()
    } catch (e) {
      toast({
        title: 'AI 处理失败',
        description: e instanceof Error ? e.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setAiLoading(false)
    }
  }

  // Get current font family
  const getCurrentFontFamily = () => {
    return FONT_FAMILIES[0].value
  }

  // Get current font size
  const getCurrentFontSize = () => {
    const fontSize = editor.getAttributes('textStyle').fontSize
    if (fontSize) {
      return fontSize.replace('pt', '')
    }
    return '12'
  }

  // Get current color
  const getCurrentColor = () => {
    return editor.getAttributes('textStyle').color || '#000000'
  }

  return (
    <div className="min-w-[420px] space-y-1 overflow-visible rounded border border-slate-200 bg-white p-1.5 text-xs text-slate-800 shadow-lg">
      {/* Row 1: Font and Size */}
      <div className="flex items-center gap-1">
        <Select
          value={getCurrentFontFamily()}
          onValueChange={() => editor.chain().focus().unsetFontFamily().run()}
        >
          <SelectTrigger className="h-6 flex-1 border-slate-300 bg-slate-100 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={getCurrentFontSize()}
          onValueChange={(value) =>
            editor
              .chain()
              .focus()
              .setMark('textStyle', { fontSize: `${value}pt` })
              .run()
          }
        >
          <SelectTrigger className="h-6 flex-1 border-blue-300 bg-blue-100 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size < 10 ? `0${size}` : size}pt
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Format buttons */}
      <div className="flex items-center gap-0.5">
        {/* Bold */}
        <Button
          size="sm"
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 text-xs ${editor.isActive('bold') ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗 (Ctrl+B)"
        >
          <span className="font-bold">B</span>
        </Button>

        {/* Italic */}
        <Button
          size="sm"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 text-xs ${editor.isActive('italic') ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (Ctrl+I)"
        >
          <span className="italic">I</span>
        </Button>

        {/* Underline */}
        <Button
          size="sm"
          variant={editor.isActive('underline') ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 text-xs ${editor.isActive('underline') ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线 (Ctrl+U)"
        >
          <span className="underline">U</span>
        </Button>

        {/* Inline code */}
        <Button
          size="sm"
          variant={editor.isActive('code') ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 ${editor.isActive('code') ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="行内代码 (Ctrl+`)"
        >
          <Icon icon="mdi:code-tags" className="h-3 w-3" />
        </Button>

        {/* Link */}
        <Popover open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={editor.isActive('link') ? 'default' : 'ghost'}
              className={`h-6 w-6 p-0 ${editor.isActive('link') ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
              onPointerDown={(e) => {
                e.preventDefault()
                const { from, to } = editor.state.selection
                savedSelectionRef.current = { from, to }
              }}
              onClick={() => {
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run()
                } else {
                  const currentUrl = editor.getAttributes('link').href || 'https://'
                  setLinkUrl(currentUrl)
                  setLinkDialogOpen(true)
                }
              }}
              title="插入链接 (Ctrl+K)"
            >
              <Icon icon="mdi:link-variant" className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 bg-white p-3"
            align="start"
            side="bottom"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
            }}
          >
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-700">插入链接</div>
              <div className="space-y-2">
                <label className="text-xs text-slate-600">链接地址:</label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (linkUrl && savedSelectionRef.current) {
                        const { from, to } = savedSelectionRef.current
                        editor
                          .chain()
                          .focus()
                          .setTextSelection({ from, to })
                          .setLink({ href: linkUrl })
                          .run()
                      }
                      setLinkDialogOpen(false)
                      setLinkUrl('')
                    } else if (e.key === 'Escape') {
                      setLinkDialogOpen(false)
                      setLinkUrl('')
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLinkDialogOpen(false)
                    setLinkUrl('')
                  }}
                  className="h-7 text-xs"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (linkUrl && savedSelectionRef.current) {
                      const { from, to } = savedSelectionRef.current
                      editor
                        .chain()
                        .focus()
                        .setTextSelection({ from, to })
                        .setLink({ href: linkUrl })
                        .run()
                    }
                    setLinkDialogOpen(false)
                    setLinkUrl('')
                  }}
                  className="h-7 bg-blue-600 text-xs hover:bg-blue-700"
                >
                  确定
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-0.5 h-4 w-px bg-slate-300" />

        {/* Alignment */}
        <Button
          size="sm"
          variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => {
            e.preventDefault()
            const { from, to } = editor.state.selection
            savedSelectionRef.current = { from, to }
          }}
          onClick={() => {
            restoreSavedSelection()
            splitSelectionByHardBreak()
            editor.chain().focus().setTextAlign('left').run()
          }}
          title="左对齐"
        >
          <Icon icon="mdi:format-align-left" className="h-3 w-3" />
        </Button>

        <Button
          size="sm"
          variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => {
            e.preventDefault()
            const { from, to } = editor.state.selection
            savedSelectionRef.current = { from, to }
          }}
          onClick={() => {
            restoreSavedSelection()
            splitSelectionByHardBreak()
            editor.chain().focus().setTextAlign('center').run()
          }}
          title="居中对齐"
        >
          <Icon icon="mdi:format-align-center" className="h-3 w-3" />
        </Button>

        <Button
          size="sm"
          variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => {
            e.preventDefault()
            const { from, to } = editor.state.selection
            savedSelectionRef.current = { from, to }
          }}
          onClick={() => {
            restoreSavedSelection()
            splitSelectionByHardBreak()
            editor.chain().focus().setTextAlign('right').run()
          }}
          title="右对齐"
        >
          <Icon icon="mdi:format-align-right" className="h-3 w-3" />
        </Button>

        <Button
          size="sm"
          variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => {
            e.preventDefault()
            const { from, to } = editor.state.selection
            savedSelectionRef.current = { from, to }
          }}
          onClick={() => {
            restoreSavedSelection()
            splitSelectionByHardBreak()
            editor.chain().focus().setTextAlign('justify').run()
          }}
          title="两端对齐"
        >
          <Icon icon="mdi:format-align-justify" className="h-3 w-3" />
        </Button>

        <div className="mx-0.5 h-4 w-px bg-slate-300" />

        {/* Bullet list */}
        <Button
          size="sm"
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 ${editor.isActive('bulletList') ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => {
            e.preventDefault()
            const { from, to } = editor.state.selection
            savedSelectionRef.current = { from, to }
          }}
          onClick={() => toggleList('bulletList')}
          title="无序列表"
        >
          <Icon icon="mdi:format-list-bulleted" className="h-3 w-3" />
        </Button>

        {/* Numbered list */}
        <Button
          size="sm"
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          className={`h-6 w-6 p-0 ${editor.isActive('orderedList') ? 'bg-slate-300' : 'hover:bg-slate-100'}`}
          onMouseDown={(e) => {
            e.preventDefault()
            const { from, to } = editor.state.selection
            savedSelectionRef.current = { from, to }
          }}
          onClick={() => toggleList('orderedList')}
          title="有序列表"
        >
          <Icon icon="mdi:format-list-numbered" className="h-3 w-3" />
        </Button>

        <div className="mx-0.5 h-4 w-px bg-slate-300" />

        {/* Text color */}
        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="relative h-6 w-6 p-0 hover:bg-slate-100"
              title="文字颜色"
              onPointerDown={(e) => {
                e.preventDefault()
                const { from, to } = editor.state.selection
                savedSelectionRef.current = { from, to }
              }}
              onClick={() => {
                setColorPickerOpen(true)
              }}
            >
              <Icon icon="mdi:format-color-text" className="h-3 w-3" />
              <div
                className="absolute bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2"
                style={{ backgroundColor: getCurrentColor() }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto bg-white p-2"
            align="end"
            side="bottom"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
            }}
          >
            <div className="grid grid-cols-4 gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="h-6 w-6 rounded border border-gray-300 transition-colors hover:border-blue-500"
                  style={{ backgroundColor: color }}
                  onPointerDown={(e) => {
                    e.preventDefault()
                  }}
                  onClick={() => {
                    requestAnimationFrame(() => {
                      applyColorWithSelection(color)
                      setColorPickerOpen(false)
                    })
                  }}
                  title={color}
                />
              ))}
              {/* Custom color button */}
              <button
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-gray-300 bg-white transition-colors hover:border-blue-500"
                title="自定义颜色"
                onPointerDown={(e) => {
                  e.preventDefault()
                  // Save current selection before opening color picker
                  const { from, to } = editor.state.selection
                  savedSelectionRef.current = { from, to }
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setColorPickerOpen(false)
                  requestAnimationFrame(() => {
                    openColorPicker(getCurrentColor(), (color) => {
                      requestAnimationFrame(() => {
                        applyColorWithSelection(color)
                      })
                    })
                  })
                }}
              >
                <Icon icon="mdi:palette" className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <div className="mx-0.5 h-4 w-px bg-slate-300" />
        {/* Clear formatting */}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 hover:bg-slate-100"
          title="清除格式"
          onMouseDown={(e) => {
            e.preventDefault()
            const { from, to } = editor.state.selection
            savedSelectionRef.current = { from, to }
          }}
          onClick={clearFormatting}
        >
          <Icon icon="mdi:format-clear" className="h-3 w-3" />
        </Button>

        <div className="mx-0.5 h-4 w-px bg-slate-300" />

        <DropdownMenu open={aiMenuOpen} onOpenChange={setAiMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-purple-50"
              title="AI 助手"
              disabled={aiLoading}
              onPointerDown={(e) => {
                e.preventDefault()
                const { from, to } = editor.state.selection
                savedSelectionRef.current = { from, to }
              }}
              onClick={() => {
                if (!aiLoading) {
                  setAiMenuOpen((open) => !open)
                }
              }}
            >
              {aiLoading ? (
                <Icon icon="mdi:loading" className="h-3 w-3 animate-spin text-purple-500" />
              ) : (
                <Icon icon="mdi:auto-fix" className="h-3 w-3 text-purple-500" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => void handleAIPolish('polish')}>
              <Icon icon="mdi:auto-fix" className="mr-2 h-4 w-4" />
              润色优化
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleAIPolish('expand')}>
              <Icon icon="mdi:text-box-plus" className="mr-2 h-4 w-4" />
              扩写内容
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleAIPolish('shorten')}>
              <Icon icon="mdi:text-box-minus" className="mr-2 h-4 w-4" />
              精简内容
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleAIPolish('translate_en')}>
              <Icon icon="mdi:translate" className="mr-2 h-4 w-4" />
              翻译为英文
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleAIPolish('translate_zh')}>
              <Icon icon="mdi:translate" className="mr-2 h-4 w-4" />
              翻译为中文
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
