import { invoke } from '@tauri-apps/api/core'
import type { ApplicationEntry, ApplicationInput } from '@/types/application'
import type {
  CreateResumeLineageInput,
  JobIntentionItem,
  JobIntentionSection,
  ModuleContentRow,
  PersonalInfoItem,
  ResumeData,
  ResumeModule,
  StoredResume,
} from '@/types/resume'

export type StorageErrorCode = 'UNAVAILABLE' | 'PARSE_ERROR' | 'QUOTA_EXCEEDED' | 'UNKNOWN'

export class StorageError extends Error {
  code: StorageErrorCode
  constructor(message: string, code: StorageErrorCode = 'UNKNOWN') {
    super(message)
    this.code = code
    this.name = 'StorageError'
  }
}

interface ResumeValidationResult {
  isValid: boolean
  errors: string[]
  normalizedData: ResumeData
}

function mapTauriError(e: unknown): StorageError {
  if (e instanceof StorageError) return e
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('no space left')) {
    return new StorageError('存储容量已满', 'QUOTA_EXCEEDED')
  }
  if (msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('not available')) {
    return new StorageError('Tauri 后端不可用', 'UNAVAILABLE')
  }
  return new StorageError(msg, 'UNKNOWN')
}

export async function getAllResumes(): Promise<StoredResume[]> {
  try {
    return await invoke<StoredResume[]>('get_all_resumes')
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function getResumeById(id: string): Promise<StoredResume | null> {
  try {
    return await invoke<StoredResume | null>('get_resume_by_id', { id })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function upsertResume(entry: StoredResume): Promise<StoredResume> {
  try {
    const existing = await invoke<StoredResume | null>('get_resume_by_id', { id: entry.id })
    if (existing) {
      return await invoke<StoredResume>('update_resume', { id: entry.id, data: entry.resumeData })
    }
    return await invoke<StoredResume>('create_resume', { entry })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function getDefaultResumeData(): Promise<ResumeData> {
  try {
    return await invoke<ResumeData>('get_default_resume_data')
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function validateResumeDataWithBackend(
  data: ResumeData,
): Promise<ResumeValidationResult> {
  try {
    return await invoke<ResumeValidationResult>('validate_resume_data_command', { data })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function importResumeFile(content: string): Promise<ResumeData> {
  try {
    return await invoke<ResumeData>('import_resume_file', { content })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function exportResumeFile(data: ResumeData): Promise<string> {
  try {
    return await invoke<string>('export_resume_file', { data })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function createPersonalInfoItem(order = 0): Promise<PersonalInfoItem> {
  try {
    return await invoke<PersonalInfoItem>('create_personal_info_item', { order })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function createJobIntentionItem(
  type: JobIntentionSection['items'][number]['type'],
  order: number,
): Promise<JobIntentionItem> {
  try {
    return await invoke<JobIntentionItem>('create_job_intention_item', { itemType: type, order })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function createResumeModule(order: number): Promise<ResumeModule> {
  try {
    return await invoke<ResumeModule>('create_resume_module', { order })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function createRichTextRow(
  columns: 1 | 2 | 3 | 4,
  order: number,
): Promise<ModuleContentRow> {
  try {
    return await invoke<ModuleContentRow>('create_rich_text_row', { columns, order })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function createTagsRow(order: number): Promise<ModuleContentRow> {
  try {
    return await invoke<ModuleContentRow>('create_tags_row', { order })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function deleteResumes(ids: string[]): Promise<void> {
  try {
    await invoke<void>('delete_resumes', { ids })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function createEntryFromData(
  data: ResumeData,
  lineage?: CreateResumeLineageInput,
): Promise<StoredResume> {
  try {
    return await invoke<StoredResume>('create_resume_from_data', { data, lineage })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function updateEntryData(id: string, data: ResumeData): Promise<StoredResume> {
  try {
    const validation = await validateResumeDataWithBackend(data)
    if (!validation.isValid) {
      throw new StorageError(`简历数据校验失败：${validation.errors.join('；')}`)
    }

    return await invoke<StoredResume>('update_resume', { id, data: validation.normalizedData })
  } catch (e) {
    if (e instanceof StorageError) throw e
    throw mapTauriError(e)
  }
}

async function loadTemplateFrom(path: string): Promise<ResumeData | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const content = await res.text()
    return await importResumeFile(content)
  } catch {
    console.warn('Failed to load template from:', path)
    return null
  }
}

export async function loadDefaultTemplate(): Promise<ResumeData> {
  const template = await loadTemplateFrom('/template.json')
  if (template) return template
  return getDefaultResumeData()
}

export function loadExampleTemplate(): Promise<ResumeData | null> {
  return loadTemplateFrom('/example.json')
}

export async function getAllApplications(): Promise<ApplicationEntry[]> {
  try {
    return await invoke<ApplicationEntry[]>('get_all_applications')
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function getApplicationById(id: string): Promise<ApplicationEntry | null> {
  try {
    return await invoke<ApplicationEntry | null>('get_application_by_id', { id })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function createApplication(data: ApplicationInput): Promise<ApplicationEntry> {
  try {
    return await invoke<ApplicationEntry>('create_application', { data })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function updateApplication(
  id: string,
  data: ApplicationInput,
): Promise<ApplicationEntry> {
  try {
    return await invoke<ApplicationEntry>('update_application', { id, data })
  } catch (e) {
    throw mapTauriError(e)
  }
}

export async function deleteApplications(ids: string[]): Promise<void> {
  try {
    await invoke<void>('delete_applications', { ids })
  } catch (e) {
    throw mapTauriError(e)
  }
}
