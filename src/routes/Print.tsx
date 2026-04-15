import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ResumeData } from '@/types/resume'
import PrintContent from '@/components/print-content'
import { parseAndValidateResumeDataJson } from '@/lib/storage'

function decodeDataParam(data?: string | null): string | null {
  if (!data) return null
  try {
    return atob(decodeURIComponent(data))
  } catch {
    return null
  }
}

export default function Print() {
  const [searchParams] = useSearchParams()
  const dataParam = searchParams.get('data')
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [resolvedDataParam, setResolvedDataParam] = useState<string | null>(null)
  const auto = searchParams.get('auto')?.toLowerCase() ?? ''
  const autoPrint = auto === '1' || auto === 'true' || auto === 'yes'

  useEffect(() => {
    let cancelled = false

    const loadResumeData = async () => {
      const decoded = decodeDataParam(dataParam)
      if (!decoded) {
        if (!cancelled) {
          setResumeData(null)
          setResolvedDataParam(dataParam)
          setLoading(false)
        }
        return
      }

      setLoading(true)

      try {
        const validated = await parseAndValidateResumeDataJson(decoded)
        if (!cancelled) {
          setResumeData(validated)
          setResolvedDataParam(dataParam)
        }
      } catch {
        if (!cancelled) {
          setResumeData(null)
          setResolvedDataParam(dataParam)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadResumeData()

    return () => {
      cancelled = true
    }
  }, [dataParam])

  if (loading || resolvedDataParam !== dataParam) {
    return <main className="bg-background min-h-screen" />
  }

  return <PrintContent initialData={resumeData} autoPrint={autoPrint} />
}
