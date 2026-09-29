import { useState } from 'react'
import { ipcErrorMessage } from '../store/ipcError'

/**
 * The Markdown export, from the Daily tab or Settings. Main opens the save
 * dialog and writes the file; this only tracks how it went.
 */
export function useHistoryExport(): {
  run: () => Promise<void>
  busy: boolean
  /** The file name of the last successful export. */
  saved: string | null
  error: string | null
} {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.export.history()
      // Cancelled: say nothing, keep whatever was shown before.
      if (result.saved) setSaved(result.fileName)
    } catch (failure) {
      setError(ipcErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return { run, busy, saved, error }
}
