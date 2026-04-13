import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ResumeBuilder from '@/components/resume-builder'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/react'
import type { ResumeData, StoredResume } from '@/types/resume'
import { createEntryFromData, getResumeById, StorageError } from '@/lib/storage'
import { useAutoSave } from '@/hooks/use-auto-save'
import { useToast } from '@/hooks/use-toast'

export default function EditResume() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [currentData, setCurrentData] = useState<ResumeData | null>(null)
  const [entry, setEntry] = useState<StoredResume | null>(null)
  const [loading, setLoading] = useState(true)

  const { status: autoSaveStatus, lastSavedText, saveNow } = useAutoSave(id, currentData)

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

  const handleSave = async () => {
    try {
      await saveNow()
      // saveNow already updates the status indicator; show toast for manual save only
      toast({ title: '保存成功' })
    } catch (e: unknown) {
      if (e instanceof StorageError && e.code === 'QUOTA_EXCEEDED') {
        toast({
          title: '保存失败：存储空间不足',
          description: '请删除一些旧的简历，或导出为 JSON 文件后清理存储。',
          variant: 'destructive',
        })
      } else {
        const message = e instanceof Error ? e.message : '未知错误'
        toast({ title: '保存失败', description: message, variant: 'destructive' })
      }
    }
  }

  const handleCreateResumeCopy = async (data: ResumeData) => {
    const entry = await createEntryFromData(data)
    navigate(`/edit/${entry.id}`)
  }

  if (loading) {
    return <main className="bg-background min-h-screen" />
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
      <ResumeBuilder
        initialData={entry.resumeData}
        onChange={setCurrentData}
        onBack={() => navigate('/resumes')}
        onSave={() => handleSave()}
        onCreateTailoredResume={(data) => handleCreateResumeCopy(data)}
        onCreateOptimizedResume={(data) => handleCreateResumeCopy(data)}
        autoSaveStatus={autoSaveStatus}
        autoSaveLastSaved={lastSavedText}
      />
    </main>
  )
}
