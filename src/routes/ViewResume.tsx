import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Icon } from '@iconify/react'
import type { StoredResume } from '@/types/resume'
import { getResumeById } from '@/lib/storage'
import ResumePreview from '@/components/resume-preview'

export default function ViewResume() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<StoredResume | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    getResumeById(id).then((e) => {
      setEntry(e)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return <main className="bg-background min-h-screen" />
  }

  if (!entry) {
    return (
      <main className="bg-background min-h-screen p-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 bg-transparent" onClick={() => navigate('/')}>
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
          <Button variant="outline" className="gap-2 bg-transparent" onClick={() => navigate('/')}>
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
