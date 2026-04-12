import { useState, useEffect, useRef, useCallback } from "react"
import type { ResumeData } from "@/types/resume"
import { updateEntryData } from "@/lib/storage"

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error"

interface AutoSaveResult {
  /** Current auto-save status */
  status: AutoSaveStatus
  /** Human-readable last saved time (e.g. "14:32:05") */
  lastSavedText: string | null
  /** Trigger an immediate save (for the manual save button) */
  saveNow: () => Promise<void>
}

/**
 * Auto-save hook with debounce. Persists data via `updateEntryData` after
 * a period of inactivity. Only saves when data has actually changed.
 */
export function useAutoSave(
  id: string | undefined,
  data: ResumeData | null,
  options: { debounceMs?: number } = {},
): AutoSaveResult {
  const { debounceMs = 2000 } = options

  const [status, setStatus] = useState<AutoSaveStatus>("idle")
  const [lastSavedText, setLastSavedText] = useState<string | null>(null)

  const lastSavedJson = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestData = useRef<ResumeData | null>(null)

  // Keep latestData ref in sync so performSave always sees the newest data
  useEffect(() => {
    latestData.current = data
  }, [data])

  const performSave = useCallback(
    async (options: { throwOnError?: boolean } = {}) => {
      const currentData = latestData.current
      if (!id || !currentData) return

      const json = JSON.stringify(currentData)
      if (json === lastSavedJson.current) return

      setStatus("saving")
      try {
        await updateEntryData(id, currentData)
        lastSavedJson.current = json
        setLastSavedText(new Date().toLocaleTimeString())
        setStatus("saved")
      } catch (e) {
        setStatus("error")
        if (options.throwOnError) throw e
      }
    },
    [id],
  )

  // Debounced auto-save: fires when data changes
  useEffect(() => {
    if (!id || !data) return

    const json = JSON.stringify(data)
    if (json === lastSavedJson.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      performSave().catch(() => {
        // Auto-save swallows errors silently (status already set to "error")
      })
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [id, data, debounceMs, performSave])

  // Reset state when switching resumes
  useEffect(() => {
    lastSavedJson.current = null
    setLastSavedText(null)
    setStatus("idle")
  }, [id])

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await performSave({ throwOnError: true })
  }, [performSave])

  return { status, lastSavedText, saveNow }
}
