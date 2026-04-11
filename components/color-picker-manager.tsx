import { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import ColorPicker from './color-picker'

interface ColorPickerContextType {
  openColorPicker: (color: string, onSave: (color: string) => void) => void
}

const ColorPickerContext = createContext<ColorPickerContextType | null>(null)

export function useColorPicker() {
  const context = useContext(ColorPickerContext)
  if (!context) {
    throw new Error('useColorPicker must be used within ColorPickerProvider')
  }
  return context
}

export function ColorPickerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialColor, setInitialColor] = useState('#000000')
  const [onSaveCallback, setOnSaveCallback] = useState<((color: string) => void) | null>(null)
  const isClient = typeof document !== 'undefined'

  const openColorPicker = useCallback((color: string, onSave: (color: string) => void) => {
    setInitialColor(color)
    setOnSaveCallback(() => onSave)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <ColorPickerContext.Provider value={{ openColorPicker }}>
      {children}
      {isClient && isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              close()
            }
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative z-10"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ColorPicker
              initialColor={initialColor}
              onSave={(color) => {
                onSaveCallback?.(color)
                close()
              }}
              onCancel={close}
            />
          </div>
        </div>,
        document.body
      )}
    </ColorPickerContext.Provider>
  )
}
