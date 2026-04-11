import { MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import { FontFamily } from "@tiptap/extension-font-family"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import { Extension } from "@tiptap/core"
import type { JSONContent } from "@/types/resume"

// Custom FontSize extension — must match rich-text-input.tsx
const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const fontSize = typeof attributes.fontSize === "string" ? attributes.fontSize : null
              if (!fontSize) return {}
              return { style: `font-size: ${fontSize}` }
            },
          },
        },
      },
    ]
  },
})

// Build extensions matching the editor configuration in rich-text-input.tsx
const extensions = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
    trailingNode: false,
    dropcursor: false,
  }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: "text-blue-600 underline hover:text-blue-800",
    },
  }),
  TextAlign.configure({
    types: ["paragraph"],
  }),
]

const markdownManager = new MarkdownManager({ extensions })

/**
 * Parse a Markdown string into Tiptap JSONContent.
 * Handles bold, italic, underline, lists, links, line breaks.
 */
export function parseMarkdown(markdown: string): JSONContent {
  return markdownManager.parse(markdown)
}

/**
 * Convert AI-generated text (which may be plain text or Markdown) into Tiptap JSONContent.
 * Uses MarkdownManager to parse the text into rich Tiptap content.
 */
export function markdownToRichContent(text: string): JSONContent {
  const trimmed = text.trim()
  if (!trimmed) {
    return { type: "doc", content: [{ type: "paragraph", content: [] }] }
  }
  return parseMarkdown(trimmed)
}
