import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { app, dialog, shell, type BrowserWindow } from 'electron'
import { todayKey } from '@shared/date'
import { IPC } from '@shared/ipc'
import type { ExportResult } from '@shared/types'
import { remote } from './remote'

/**
 * The history as a Markdown file, written wherever the user picks in a native
 * save dialog. The cloud writes the Markdown (src/core/markdown.ts).
 */

/** Where the last export went, so "Show in folder" never needs a path from the renderer. */
let lastExport: string | null = null

export async function exportHistory(window: BrowserWindow | null): Promise<ExportResult> {
  const markdown = await remote<string>(IPC.exportMarkdown)

  const options = {
    title: 'Export history',
    defaultPath: join(app.getPath('documents'), `career-app-history-${todayKey()}.md`),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  }
  const choice = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
  if (choice.canceled || !choice.filePath) return { saved: false, fileName: null }

  await fs.writeFile(choice.filePath, markdown, 'utf-8')
  lastExport = choice.filePath
  return { saved: true, fileName: basename(choice.filePath) }
}

/** Opens Explorer with the last exported file selected. */
export function revealLastExport(): void {
  if (lastExport) shell.showItemInFolder(lastExport)
}
