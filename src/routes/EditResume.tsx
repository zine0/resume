import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ResumeBuilder from "@/components/resume-builder"
import { Button } from "@/components/ui/button"
import { Icon } from "@iconify/react"
import type { ResumeData, StoredResume } from "@/types/resume"
import { getResumeById, updateEntryData, StorageError } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"

export default function EditResume() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [, setCurrentData] = useState<ResumeData | null>(null)

  const entry = useMemo<StoredResume | null>(() => (id ? getResumeById(id) : null), [id])

  const handleSave = async (data: ResumeData) => {
    try {
      if (!id) return
      const updated = updateEntryData(id, data)
      toast({ title: "保存成功", description: new Date(updated.updatedAt).toLocaleString() })
    } catch (e: unknown) {
      if (e instanceof StorageError && e.code === "QUOTA_EXCEEDED") {
        toast({
          title: "保存失败：存储空间不足",
          description: "请删除一些旧的简历，或导出为 JSON 文件后清理存储。",
          variant: "destructive",
        })
      } else {
        const message = e instanceof Error ? e.message : "未知错误"
        toast({ title: "保存失败", description: message, variant: "destructive" })
      }
    }
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
      <ResumeBuilder
        initialData={entry.resumeData}
        onChange={setCurrentData}
        onBack={() => navigate("/")}
        onSave={(data) => handleSave(data)}
      />
    </main>
  )
}
