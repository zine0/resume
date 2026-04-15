import { Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ResumeBuilder from '@/components/resume-builder'
import type { CreateResumeLineageInput, ResumeData, StoredResume } from '@/types/resume'
import {
  createEntryFromData,
  parseAndValidateResumeDataJson,
  StorageError,
  getResumeById,
} from '@/lib/storage'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/react'

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

  const cloneId = searchParams.get('clone')
  const useExample = searchParams.get('example') === '1' || searchParams.get('example') === 'true'

  const [prefetchedData, setPrefetchedData] = useState<ResumeData | undefined>(undefined)
  const [prefetchedLoading, setPrefetchedLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadPrefetchedData = async () => {
      const raw = sessionStorage.getItem('new-edit-initial-data')
      if (!raw) {
        if (!cancelled) {
          setPrefetchedData(undefined)
          setPrefetchedLoading(false)
        }
        return
      }

      sessionStorage.removeItem('new-edit-initial-data')

      try {
        const validated = await parseAndValidateResumeDataJson(raw)
        if (!cancelled) {
          setPrefetchedData(validated)
        }
      } catch (error) {
        if (cancelled) return

        setPrefetchedData(undefined)
        toast({
          title: '预加载简历数据无效',
          description: error instanceof Error ? error.message : '无法恢复预加载的简历数据。',
          variant: 'destructive',
        })
      } finally {
        if (!cancelled) {
          setPrefetchedLoading(false)
        }
      }
    }

    void loadPrefetchedData()

    return () => {
      cancelled = true
    }
  }, [toast])

  // 异步加载克隆数据
  const [clonedData, setClonedData] = useState<ResumeData | undefined>(undefined)
  const [clonedEntry, setClonedEntry] = useState<StoredResume | null>(null)
  const [cloneLoading, setCloneLoading] = useState(false)
  const [cloneLoadError, setCloneLoadError] = useState<string | null>(null)
  const [cloneReloadKey, setCloneReloadKey] = useState(0)
  const [resolvedCloneId, setResolvedCloneId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void cloneReloadKey

    const loadClonedEntry = async () => {
      if (!cloneId) {
        setClonedEntry(null)
        setClonedData(undefined)
        setCloneLoadError(null)
        setResolvedCloneId(null)
        setCloneLoading(false)
        return
      }

      setCloneLoading(true)
      setCloneLoadError(null)

      try {
        const entry = await getResumeById(cloneId)
        if (cancelled) return

        setClonedEntry(entry)
        setClonedData(entry ? { ...entry.resumeData } : undefined)
        setResolvedCloneId(cloneId)
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof Error ? error.message : '加载要复制的简历失败，请稍后再试。'
        setClonedEntry(null)
        setClonedData(undefined)
        setCloneLoadError(message)
        setResolvedCloneId(cloneId)
        toast({ title: '加载简历失败', description: message, variant: 'destructive' })
      } finally {
        if (!cancelled) {
          setCloneLoading(false)
        }
      }
    }

    loadClonedEntry()

    return () => {
      cancelled = true
    }
  }, [cloneId, cloneReloadKey, toast])

  const buildDerivedLineage = (
    variantKind: CreateResumeLineageInput['variantKind'],
  ): CreateResumeLineageInput | undefined => {
    if (!clonedEntry || !variantKind) return undefined
    return {
      familyId: clonedEntry.lineage.familyId,
      parentResumeId: clonedEntry.id,
      variantKind,
    }
  }

  const handleSave = async (current: ResumeData) => {
    try {
      const entry = await createEntryFromData(current, buildDerivedLineage('clone'))
      toast({ title: '保存成功', description: `已创建：${entry.resumeData.title}` })
      navigate(`/edit/${entry.id}`, { replace: true })
    } catch (e: unknown) {
      if (e instanceof StorageError && e.code === 'QUOTA_EXCEEDED') {
        toast({
          title: '保存失败：存储空间不足',
          description: '请删除一些旧的简历，或导出为 JSON 后清理存储。',
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
    variantKind: CreateResumeLineageInput['variantKind'],
  ) => {
    const entry = await createEntryFromData(data, buildDerivedLineage(variantKind))
    navigate(`/edit/${entry.id}`)
  }

  if (cloneLoading || prefetchedLoading || cloneId !== resolvedCloneId) {
    return <main className="bg-background min-h-screen" />
  }

  if (cloneLoadError) {
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
          <Button variant="outline" onClick={() => setCloneReloadKey((value) => value + 1)}>
            重新加载
          </Button>
          <span className="text-destructive text-sm">{cloneLoadError}</span>
        </div>
      </main>
    )
  }

  if (cloneId && !clonedEntry) {
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
          <span className="text-destructive text-sm">未找到要复制的简历</span>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-background min-h-screen">
      <ResumeBuilder
        initialData={clonedData ?? prefetchedData}
        template={useExample ? 'example' : 'default'}
        onBack={() => navigate('/resumes')}
        onSave={(d) => handleSave(d)}
        onCreateTailoredResume={(d) => handleCreateResumeCopy(d, 'jdTailored')}
        onCreateOptimizedResume={(d) => handleCreateResumeCopy(d, 'optimized')}
      />
    </main>
  )
}
