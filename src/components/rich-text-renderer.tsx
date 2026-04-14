import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { FontFamily } from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Extension } from '@tiptap/core'
import type { JSONContent } from '@/types/resume'
import { stripFontFamilyFromRichContent } from '@/lib/rich-text'

interface RichTextRendererProps {
  content: JSONContent
  className?: string
}

// Custom extension for font size
const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const fontSize = typeof attributes.fontSize === 'string' ? attributes.fontSize : null
              if (!fontSize) {
                return {}
              }
              return {
                style: `font-size: ${fontSize}`,
              }
            },
          },
        },
      },
    ]
  },
})

// Default empty content
const getDefaultContent = (): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
})

/**
 * Read-only Tiptap renderer for preview
 */
export default function RichTextRenderer({ content, className = '' }: RichTextRendererProps) {
  const sanitizedContent = stripFontFamilyFromRichContent(content || getDefaultContent())

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        trailingNode: false,
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TextAlign.configure({
        types: ['paragraph'],
      }),
    ],
    content: sanitizedContent,
    editable: false,
    editorProps: {
      attributes: {
        class: className,
      },
    },
  })

  // Update content when it changes
  useEffect(() => {
    if (!editor) return

    const newContent = stripFontFamilyFromRichContent(content || getDefaultContent())
    const currentContent = editor.getJSON()

    // Only update if content actually changed
    if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
      editor.commands.setContent(newContent)
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return <EditorContent editor={editor} />
}
