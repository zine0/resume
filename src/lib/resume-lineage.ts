import type { ResumeLineage, ResumeVariantKind, StoredResume } from '@/types/resume'

const VARIANT_LABELS: Record<ResumeVariantKind, string> = {
  base: 'Base',
  clone: 'Clone',
  optimized: 'Optimized',
  jdTailored: 'JD Tailored',
}

export function getResumeVariantLabel(variantKind: ResumeVariantKind): string {
  return VARIANT_LABELS[variantKind]
}

export function getResumeLineageHint(lineage: ResumeLineage): string | null {
  if (lineage.sourceApplicationId) {
    return `来自岗位 ${lineage.sourceApplicationId.slice(0, 8)}`
  }

  if (lineage.parentResumeId) {
    return `派生自 ${lineage.parentResumeId.slice(0, 8)}`
  }

  return null
}

export function getResumeDisplayTitle(resume: StoredResume): string {
  const title = resume.resumeData.title || '未命名简历'
  return `${title} · ${getResumeVariantLabel(resume.lineage.variantKind)}`
}
