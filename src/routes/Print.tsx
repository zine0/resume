import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ResumeData } from '@/types/resume'
import PrintContent from '@/components/print-content'

function decodeDataParam(data?: string | null): ResumeData | null {
  if (!data) return null
  try {
    const json = atob(decodeURIComponent(data))
    return JSON.parse(json) as ResumeData
  } catch {
    return null
  }
}

export default function Print() {
  const [searchParams] = useSearchParams()
  const resumeData = useMemo(() => decodeDataParam(searchParams.get('data')), [searchParams])
  const auto = searchParams.get('auto')?.toLowerCase() ?? ''
  const autoPrint = auto === '1' || auto === 'true' || auto === 'yes'

  return <PrintContent initialData={resumeData} autoPrint={autoPrint} />
}
