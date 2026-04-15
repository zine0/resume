import { describe, it, expect } from 'vitest'
import { cn, generatePdfFilename } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('generatePdfFilename', () => {
  it('uses resume title when provided', () => {
    const result = generatePdfFilename('MyResume')
    const date = new Date().toISOString().slice(0, 10)
    expect(result).toBe(`简历-MyResume-${date}.pdf`)
  })

  it('falls back to "未命名" when title is empty', () => {
    const result = generatePdfFilename('')
    const date = new Date().toISOString().slice(0, 10)
    expect(result).toBe(`简历-未命名-${date}.pdf`)
  })

  it('falls back to "未命名" when title is whitespace only', () => {
    const result = generatePdfFilename('   ')
    const date = new Date().toISOString().slice(0, 10)
    expect(result).toBe(`简历-未命名-${date}.pdf`)
  })

  it('encodes special ASCII characters like spaces', () => {
    const result = generatePdfFilename('hello world')
    const date = new Date().toISOString().slice(0, 10)
    expect(result).toBe(`简历-hello%20world-${date}.pdf`)
  })

  it('preserves CJK characters unchanged', () => {
    const result = generatePdfFilename('前端工程师')
    const date = new Date().toISOString().slice(0, 10)
    expect(result).toBe(`简历-前端工程师-${date}.pdf`)
  })
})
