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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const {
    status: autoSaveStatus,
    lastSavedText,
    lastErrorMessage: autoSaveErrorMessage,
    saveNow,
  } = useAutoSave(id, currentData)

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

  const handleCreateResumeCopy = async (
    data: ResumeData,
    variantKind: StoredResume['lineage']['variantKind'],
  ) => {
    if (!entry) return
    const createdEntry = await createEntryFromData(data, {
      familyId: entry.lineage.familyId,
      parentResumeId: entry.id,
      variantKind,
    })
    navigate(`/edit/${createdEntry.id}`)
  }

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
      <ResumeBuilder
        initialData={entry.resumeData}
        onChange={setCurrentData}
        onBack={() => navigate('/resumes')}
        onSave={() => handleSave()}
        onCreateTailoredResume={(data) => handleCreateResumeCopy(data, 'jdTailored')}
        onCreateOptimizedResume={(data) => handleCreateResumeCopy(data, 'optimized')}
        autoSaveStatus={autoSaveStatus}
        autoSaveLastSaved={lastSavedText}
        autoSaveErrorMessage={autoSaveErrorMessage}
      />
    </main>
  )
}
