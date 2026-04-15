import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageError, parseAndValidateResumeDataJson } from '@/lib/storage'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@/lib/icon-storage', () => ({
  normalizeResumeDataIcons: vi.fn((data: unknown) => Promise.resolve(data)),
  normalizeStoredResumeIcons: vi.fn((entry: unknown) => Promise.resolve(entry)),
}))

const mockResumeData = {
  title: 'Test Resume',
  personalInfoSection: {
    personalInfo: [],
    jobIntention: {
      sections: [],
    },
  },
  modules: [],
}

describe('StorageError', () => {
  it('sets message, code, and name from constructor', () => {
    const err = new StorageError('test error', 'PARSE_ERROR')
    expect(err.message).toBe('test error')
    expect(err.code).toBe('PARSE_ERROR')
    expect(err.name).toBe('StorageError')
  })

  it('defaults code to UNKNOWN when not provided', () => {
    const err = new StorageError('fallback')
    expect(err.code).toBe('UNKNOWN')
  })

  it('is an instance of Error', () => {
    const err = new StorageError('msg', 'QUOTA_EXCEEDED')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(StorageError)
  })
})

describe('parseAndValidateResumeDataJson', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws StorageError with PARSE_ERROR for invalid JSON', async () => {
    await expect(parseAndValidateResumeDataJson('{ invalid json')).rejects.toThrow(StorageError)
    try {
      await parseAndValidateResumeDataJson('{ invalid json')
    } catch (e) {
      expect((e as StorageError).code).toBe('PARSE_ERROR')
      expect((e as StorageError).message).toBe('简历数据格式错误')
    }
  })

  it('throws StorageError with PARSE_ERROR when backend validation fails', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue({
      isValid: false,
      errors: ['missing title', 'invalid module'],
      normalizedData: null,
    })

    try {
      await parseAndValidateResumeDataJson('{"title":"x"}')
    } catch (e) {
      expect(e).toBeInstanceOf(StorageError)
      const err = e as StorageError
      expect(err.code).toBe('PARSE_ERROR')
      expect(err.message).toContain('简历数据校验失败')
      expect(err.message).toContain('missing title')
      expect(err.message).toContain('invalid module')
    }
  })

  it('returns normalized data when backend validation succeeds', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue({
      isValid: true,
      errors: [],
      normalizedData: mockResumeData,
    })

    const result = await parseAndValidateResumeDataJson(JSON.stringify(mockResumeData))
    expect(result).toEqual(mockResumeData)
  })

  it('throws StorageError with PARSE_ERROR when invoke throws non-StorageError', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockRejectedValue(new Error('backend crashed'))

    try {
      await parseAndValidateResumeDataJson('{"title":"x"}')
    } catch (e) {
      expect(e).toBeInstanceOf(StorageError)
      expect((e as StorageError).code).toBe('PARSE_ERROR')
    }
  })

  it('preserves QUOTA_EXCEEDED code from underlying invoke error', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockRejectedValue(new Error('no space left on device'))

    try {
      await parseAndValidateResumeDataJson('{"title":"x"}')
    } catch (e) {
      expect(e).toBeInstanceOf(StorageError)
      expect((e as StorageError).code).toBe('QUOTA_EXCEEDED')
    }
  })
})
