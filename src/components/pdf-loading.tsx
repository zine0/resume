import React from 'react'

export default function PdfLoading({
  message = '正在生成 PDF，请稍候…',
  fullScreen = false,
}: {
  message?: string
  fullScreen?: boolean
}) {
  const boxClass = fullScreen
    ? 'w-full h-screen flex flex-col items-center justify-center gap-3'
    : 'w-full h-full flex flex-col items-center justify-center gap-3'
  return (
    <div className={boxClass}>
      <svg className="text-muted-foreground h-8 w-8 animate-spin" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <div className="text-muted-foreground text-sm">{message}</div>
    </div>
  )
}
