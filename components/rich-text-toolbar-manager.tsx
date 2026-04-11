import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import RichTextToolbar from './rich-text-toolbar'

interface ToolbarContextType {
  registerEditor: (editor: Editor) => (() => void) | undefined
  unregisterEditor: (editor: Editor) => void
}

const ToolbarContext = createContext<ToolbarContextType | null>(null)

export function useToolbarManager() {
  const context = useContext(ToolbarContext)
  if (!context) {
    throw new Error('useToolbarManager must be used within ToolbarProvider')
  }
  return context
}

export function ToolbarProvider({ children }: { children: React.ReactNode }) {
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })
  const isClient = typeof document !== 'undefined'

  const updateToolbarPosition = useCallback((editor: Editor) => {
    const { from, to } = editor.state.selection
    const hasSelection = from !== to

    if (hasSelection) {
      const { view } = editor
      const start = view.coordsAtPos(from)
      const end = view.coordsAtPos(to)

      const toolbarWidth = 300
      const toolbarHeight = 80

      // Calculate horizontal position
      let left = (start.left + end.left) / 2 - toolbarWidth / 2
      if (left < 10) left = 10
      if (left + toolbarWidth > window.innerWidth - 10) {
        left = window.innerWidth - toolbarWidth - 10
      }

      // Calculate vertical position (above selection)
      let top = start.top - toolbarHeight - 10

      // If not enough space above, show below
      if (top < 10) {
        top = end.bottom + 10
      }

      setToolbarPosition({ top, left })
      setShowToolbar(true)
      setActiveEditor(editor)
    } else {
      setShowToolbar(false)
      setActiveEditor(null)
    }
  }, [])

  const registerEditor = useCallback((editor: Editor) => {
    const handleSelectionUpdate = () => {
      updateToolbarPosition(editor)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)

    // Return cleanup function
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [updateToolbarPosition])

  const unregisterEditor = useCallback((editor: Editor) => {
    if (editor === activeEditor) {
      setShowToolbar(false)
      setActiveEditor(null)
    }
  }, [activeEditor])

  // Update position on scroll
  useEffect(() => {
    if (!showToolbar || !activeEditor) return

    const handleScroll = () => {
      updateToolbarPosition(activeEditor)
    }

    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [showToolbar, activeEditor, updateToolbarPosition])

  // Hide toolbar when clicking outside
  useEffect(() => {
    if (!showToolbar) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Don't hide if clicking on toolbar or editor
      if (
        target.closest('.rich-text-toolbar') ||
        target.closest('.ProseMirror') ||
        target.closest('[role="dialog"]') || // Popover/Dialog
        target.closest('[data-radix-popper-content-wrapper]') || // Radix UI popovers
        target.closest('.color-picker-modal') // Color picker modal
      ) {
        return
      }

      setShowToolbar(false)
      setActiveEditor(null)
    }

    // Use capture phase to handle before other handlers
    document.addEventListener('mousedown', handleClickOutside, true)
    return () => document.removeEventListener('mousedown', handleClickOutside, true)
  }, [showToolbar])

  return (
    <ToolbarContext.Provider value={{ registerEditor, unregisterEditor }}>
      {children}
      {isClient && showToolbar && activeEditor && createPortal(
        <div
          className="fixed z-50 rich-text-toolbar"
          style={{
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
          }}
        >
          <RichTextToolbar editor={activeEditor} />
        </div>,
        document.body
      )}
    </ToolbarContext.Provider>
  )
}
