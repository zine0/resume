import { Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ResumeBuilder from '@/components/resume-builder'
import type { CreateResumeLineageInput, ResumeData, StoredResume } from '@/types/resume'
import { createEntryFromData, StorageError, getResumeById } from '@/lib/storage'
import { useToast } from '@/hooks/use-toast'

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

  // 从 sessionStorage 恢复用户中心预加载的数据
  const prefetchedData: ResumeData | undefined = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('new-edit-initial-data')
      if (!raw) return undefined
      const parsed = JSON.parse(raw) as ResumeData
      sessionStorage.removeItem('new-edit-initial-data')
      return parsed
    } catch {
      return undefined
    }
  }, [])

  // 异步加载克隆数据
  const [clonedData, setClonedData] = useState<ResumeData | undefined>(undefined)
  const [clonedEntry, setClonedEntry] = useState<StoredResume | null>(null)

  useEffect(() => {
    if (!cloneId) return
    getResumeById(cloneId).then((entry) => {
      if (entry) {
        setClonedEntry(entry)
        setClonedData({ ...entry.resumeData })
      }
    })
  }, [cloneId])

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
