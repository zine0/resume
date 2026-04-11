import { Suspense, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import ResumeBuilder from "@/components/resume-builder"
import type { ResumeData } from "@/types/resume"
import { createEntryFromData, StorageError, getResumeById } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"

export default function EditNew() {
  return (
    <Suspense fallback={null}>
      <EditNewContent />
    </Suspense>
  )
}

function EditNewContent() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const cloneId = searchParams.get("clone")
  const useExample = searchParams.get("example") === "1" || searchParams.get("example") === "true"

  // 从 sessionStorage 恢复用户中心预加载的数据
  const prefetchedData: ResumeData | undefined = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("new-edit-initial-data")
      if (!raw) return undefined
      const parsed = JSON.parse(raw) as ResumeData
      sessionStorage.removeItem("new-edit-initial-data")
      return parsed
    } catch {
      return undefined
    }
  }, [])

  // 同步派生克隆数据
  const clonedData: ResumeData | undefined = useMemo(() => {
    if (!cloneId) return undefined
    const entry = getResumeById(cloneId)
    return entry ? { ...entry.resumeData } : undefined
  }, [cloneId])

  const handleSave = async (current: ResumeData) => {
    try {
      const entry = createEntryFromData(current)
      toast({ title: "保存成功", description: `已创建：${entry.resumeData.title}` })
      navigate(`/edit/${entry.id}`, { replace: true })
    } catch (e: unknown) {
      if (e instanceof StorageError && e.code === "QUOTA_EXCEEDED") {
        toast({
          title: "保存失败：存储空间不足",
          description: "请删除一些旧的简历，或导出为 JSON 后清理存储。",
          variant: "destructive",
        })
      } else {
        const message = e instanceof Error ? e.message : "未知错误"
        toast({ title: "保存失败", description: message, variant: "destructive" })
      }
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <ResumeBuilder
        initialData={clonedData ?? prefetchedData}
        template={useExample ? "example" : "default"}
        onBack={() => navigate("/")}
        onSave={(d) => handleSave(d)}
      />
    </main>
  )
}
