import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Icon } from "@iconify/react"
import type { StoredResume } from "@/types/resume"
import { getResumeById } from "@/lib/storage"
import ResumePreview from "@/components/resume-preview"

export default function ViewResume() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<StoredResume | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    getResumeById(id).then((e) => {
      setEntry(e)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return <main className="min-h-screen bg-background" />
  }

  if (!entry) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 bg-transparent" onClick={() => navigate("/")}>
            <Icon icon="mdi:arrow-left" className="w-4 h-4" /> 返回
          </Button>
          <span className="text-sm text-destructive">未找到该简历</span>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 bg-transparent" onClick={() => navigate("/")}>
            <Icon icon="mdi:arrow-left" className="w-4 h-4" /> 返回
          </Button>
          <span className="text-sm text-muted-foreground">预览：{entry.resumeData.title}</span>
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
