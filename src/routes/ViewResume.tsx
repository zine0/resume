import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Icon } from '@iconify/react'
import type { StoredResume } from '@/types/resume'
import { getResumeById } from '@/lib/storage'
import ResumePreview from '@/components/resume-preview'
import { useToast } from '@/hooks/use-toast'

export default function ViewResume() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [entry, setEntry] = useState<StoredResume | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void reloadKey

    const loadEntry = async () => {
      if (!id) {
        setEntry(null)
        setLoadError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError(null)

      try {
        const nextEntry = await getResumeById(id)
        if (cancelled) return
        setEntry(nextEntry)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : '加载简历失败，请稍后再试。'
        setEntry(null)
        setLoadError(message)
        toast({ title: '加载简历失败', description: message, variant: 'destructive' })
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadEntry()

    return () => {
      cancelled = true
    }
  }, [id, reloadKey, toast])

  if (loading) {
    return <main className="bg-background min-h-screen" />
  }

  if (loadError) {
    return (
      <main className="bg-background min-h-screen p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => navigate('/resumes')}
          >
            <Icon icon="mdi:arrow-left" className="h-4 w-4" /> 返回
          </Button>
          <Button variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
            重新加载
          </Button>
          <span className="text-destructive text-sm">{loadError}</span>
        </div>
      </main>
    )
  }

  if (!entry) {
    return (
      <main className="bg-background min-h-screen p-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => navigate('/resumes')}
          >
            <Icon icon="mdi:arrow-left" className="h-4 w-4" /> 返回
          </Button>
          <span className="text-destructive text-sm">未找到该简历</span>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-background min-h-screen">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => navigate('/resumes')}
          >
            <Icon icon="mdi:arrow-left" className="h-4 w-4" /> 返回
          </Button>
          <span className="text-muted-foreground text-sm">预览：{entry.resumeData.title}</span>
        </div>
      </div>
      <Separator />
      <div className="flex justify-center p-6 md:p-8">
        <div className="w-[210mm] max-w-full bg-white shadow-sm">
          <ResumePreview resumeData={entry.resumeData} />
        </div>
      </div>
    </main>
  )
}
