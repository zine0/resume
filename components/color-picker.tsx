import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface ColorPickerProps {
  initialColor: string
  onSave: (color: string) => void
  onCancel: () => void
}

export default function ColorPicker({ initialColor, onSave, onCancel }: ColorPickerProps) {
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(100)
  const [brightness, setBrightness] = useState(100)
  const [r, setR] = useState(0)
  const [g, setG] = useState(0)
  const [b, setB] = useState(0)
  const [hex, setHex] = useState("")

  const saturationRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const [isDraggingSaturation, setIsDraggingSaturation] = useState(false)
  const [isDraggingHue, setIsDraggingHue] = useState(false)

  // 使用 ref 存储最新的 hue, saturation, brightness 值
  const hueRef2 = useRef(hue)
  const saturationRef2 = useRef(saturation)
  const brightnessRef2 = useRef(brightness)

  useEffect(() => {
    hueRef2.current = hue
    saturationRef2.current = saturation
    brightnessRef2.current = brightness
  }, [hue, saturation, brightness])

  // 初始化颜色
  useEffect(() => {
    const color = initialColor.replace('#', '')
    const r = parseInt(color.substring(0, 2), 16)
    const g = parseInt(color.substring(2, 4), 16)
    const b = parseInt(color.substring(4, 6), 16)
    setR(r)
    setG(g)
    setB(b)
    setHex(color.toUpperCase())

    const hsb = rgbToHsb(r, g, b)
    setHue(hsb.h)
    setSaturation(hsb.s)
    setBrightness(hsb.b)
  }, [initialColor])

  // RGB 转 HSB
  function rgbToHsb(r: number, g: number, b: number) {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min

    let h = 0
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / delta + 2) / 6
      else h = ((r - g) / delta + 4) / 6
    }

    const s = max === 0 ? 0 : delta / max
    const v = max

    return { h: h * 360, s: s * 100, b: v * 100 }
  }

  // HSB 转 RGB
  function hsbToRgb(h: number, s: number, b: number) {
    h = h / 360
    s = s / 100
    b = b / 100

    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = b * (1 - s)
    const q = b * (1 - f * s)
    const t = b * (1 - (1 - f) * s)

    let r = 0, g = 0, bl = 0
    switch (i % 6) {
      case 0: r = b; g = t; bl = p; break
      case 1: r = q; g = b; bl = p; break
      case 2: r = p; g = b; bl = t; break
      case 3: r = p; g = q; bl = b; break
      case 4: r = t; g = p; bl = b; break
      case 5: r = b; g = p; bl = q; break
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(bl * 255)
    }
  }

  // 更新颜色
  function updateColor(newHue: number, newSat: number, newBright: number) {
    setHue(newHue)
    setSaturation(newSat)
    setBrightness(newBright)

    const rgb = hsbToRgb(newHue, newSat, newBright)
    setR(rgb.r)
    setG(rgb.g)
    setB(rgb.b)

    const hexValue = `${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`.toUpperCase()
    setHex(hexValue)
  }

  // 从 RGB 更新
  function updateFromRgb(newR: number, newG: number, newB: number) {
    setR(newR)
    setG(newG)
    setB(newB)

    const hsb = rgbToHsb(newR, newG, newB)
    setHue(hsb.h)
    setSaturation(hsb.s)
    setBrightness(hsb.b)

    const hexValue = `${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`.toUpperCase()
    setHex(hexValue)
  }

  // 从 HEX 更新
  function updateFromHex(hexValue: string) {
    if (hexValue.length === 6) {
      const newR = parseInt(hexValue.substring(0, 2), 16)
      const newG = parseInt(hexValue.substring(2, 4), 16)
      const newB = parseInt(hexValue.substring(4, 6), 16)

      if (!isNaN(newR) && !isNaN(newG) && !isNaN(newB)) {
        updateFromRgb(newR, newG, newB)
      }
    }
  }

  // 处理饱和度/亮度面板点击
  function handleSaturationMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    updateSaturationFromMouse(e)
    setIsDraggingSaturation(true)
  }

  function updateSaturationFromMouse(e: React.MouseEvent | MouseEvent) {
    if (!saturationRef.current) return
    const rect = saturationRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))

    const newSat = (x / rect.width) * 100
    const newBright = 100 - (y / rect.height) * 100

    updateColor(hueRef2.current, newSat, newBright)
  }

  // 处理色相滑块点击
  function handleHueMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    setIsDraggingHue(true)
    updateHueFromMouse(e)
  }

  function updateHueFromMouse(e: React.MouseEvent | MouseEvent) {
    if (!hueRef.current) return
    const rect = hueRef.current.getBoundingClientRect()
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    const newHue = (y / rect.height) * 360

    updateColor(newHue, saturationRef2.current, brightnessRef2.current)
  }

  // 鼠标移动和释放事件
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (isDraggingSaturation) {
        updateSaturationFromMouse(e)
      }
      if (isDraggingHue) {
        updateHueFromMouse(e)
      }
    }

    function handleMouseUp() {
      setIsDraggingSaturation(false)
      setIsDraggingHue(false)
    }

    if (isDraggingSaturation || isDraggingHue) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    // 移除 hue, saturation, brightness 依赖，避免在拖拽时重新创建监听器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraggingSaturation, isDraggingHue])

  const currentColor = `#${hex}`
  const hueColor = `hsl(${hue}, 100%, 50%)`

  return (
    <div className="bg-white p-3 rounded-lg w-[280px]" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex gap-2">
        {/* 左侧：饱和度/亮度选择器 */}
        <div
          ref={saturationRef}
          className="relative w-40 h-40 rounded cursor-crosshair flex-shrink-0"
          style={{
            background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${hueColor})`
          }}
          onMouseDown={handleSaturationMouseDown}
        >
          <div
            className="absolute w-3 h-3 border-2 border-white rounded-full shadow-lg pointer-events-none"
            style={{
              left: `${saturation}%`,
              top: `${100 - brightness}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>

        {/* 色相滑块 */}
        <div
          ref={hueRef}
          className="relative w-5 h-40 rounded cursor-pointer flex-shrink-0"
          style={{
            background: 'linear-gradient(to bottom, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
          }}
          onMouseDown={handleHueMouseDown}
        >
          <div
            className="absolute w-full h-1 border-2 border-white shadow-lg pointer-events-none"
            style={{
              top: `${(hue / 360) * 100}%`,
              transform: 'translateY(-50%)'
            }}
          />
        </div>

        {/* 右侧：输入框 */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {/* RGB 输入 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium w-3">R</span>
              <input
                type="number"
                min="0"
                max="255"
                value={r}
                onChange={(e) => updateFromRgb(parseInt(e.target.value) || 0, g, b)}
                className="flex-1 px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 w-full"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium w-3">G</span>
              <input
                type="number"
                min="0"
                max="255"
                value={g}
                onChange={(e) => updateFromRgb(r, parseInt(e.target.value) || 0, b)}
                className="flex-1 px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 w-full"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium w-3">B</span>
              <input
                type="number"
                min="0"
                max="255"
                value={b}
                onChange={(e) => updateFromRgb(r, g, parseInt(e.target.value) || 0)}
                className="flex-1 px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 w-full"
              />
            </div>
          </div>

          {/* HEX 输入 */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium">#</span>
            <input
              type="text"
              value={hex}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()
                setHex(value)
                updateFromHex(value)
              }}
              className="flex-1 px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 w-full"
              maxLength={6}
            />
          </div>

          {/* 颜色预览 */}
          <div
            className="w-full h-10 rounded border border-gray-300 mt-1"
            style={{ backgroundColor: currentColor }}
          />
        </div>
      </div>

      {/* 按钮 */}
      <div className="flex gap-2 mt-3 justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          className="px-4 h-7 text-xs"
        >
          取消
        </Button>
        <Button
          onClick={() => onSave(currentColor)}
          className="px-4 h-7 text-xs bg-blue-500 hover:bg-blue-600"
        >
          保存
        </Button>
      </div>
    </div>
  )
}
