import { ColorPickerProvider } from '@/components/color-picker-manager'
import { ToolbarProvider } from '@/components/rich-text-toolbar-manager'
import type { ReactNode } from 'react'

/**
 * Layout wrapper that provides editor-specific context (color picker, toolbar)
 * only to routes that actually use rich text editing.
 *
 * Previously these providers wrapped the entire app from App.tsx,
 * but they are only consumed by the rich-text-input → module-editor → resume-builder chain,
 * which only exists on edit routes.
 */
export function EditLayout({ children }: { children: ReactNode }) {
  return (
    <ColorPickerProvider>
      <ToolbarProvider>{children}</ToolbarProvider>
    </ColorPickerProvider>
  )
}
