import React, { useState } from 'react'
import type { ResumeData } from '@/types/resume'
import ResumePreview from '@/components/resume-preview'

export default function PrintContent({
  initialData,
  autoPrint = false,
}: {
  initialData?: ResumeData | null
  autoPrint?: boolean
}) {
  // 避免在 effect 中同步 setState：打印页面仅接受显式传入的数据
  const [resumeData] = useState<ResumeData | null>(() => {
    return initialData ?? null
  })

  // Auto print once when requested and data is ready
  React.useEffect(() => {
    let done = false
    const run = async () => {
      if (!autoPrint || !resumeData || done) return
      done = true
      try {
        const anyDoc = document as unknown as { fonts?: { ready?: Promise<unknown> } }
        if (anyDoc.fonts?.ready) await anyDoc.fonts.ready
      } catch {
        // document.fonts.ready may not be available
      }
      // small delay to ensure layout settles
      setTimeout(() => {
        try {
          window.print()
        } catch {
          // window.print() may fail in some environments
        }
      }, 30)
    }
    run()
    return () => {
      done = true
    }
  }, [autoPrint, resumeData])

  return (
    <div className="pdf-preview-mode">
      {resumeData ? (
        <ResumePreview resumeData={resumeData} />
      ) : (
        <div className="resume-content p-8">
          <h1 className="mb-4 text-xl font-bold">无法加载简历数据</h1>
          <p className="text-muted-foreground">请通过后端生成接口或附带 data 参数访问本页面。</p>
        </div>
      )}
    </div>
  )
}
