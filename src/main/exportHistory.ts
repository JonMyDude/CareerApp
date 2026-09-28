import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { app, dialog, shell, type BrowserWindow } from 'electron'
import { todayKey } from '@shared/date'
import type { DailyEntry, ExportResult } from '@shared/types'
import { getDaily } from './daily'

/**
 * The suggestion history as a Markdown file, written wherever the user picks
 * in a native save dialog. Nothing leaves the machine.
 */

/**
 * Suggestions and notes are plain text, so a line that happens to start with
 * "#", ">", "- " or "1." would turn into a heading, quote or list. Escape just
 * that; the explanations' backticked code is meant to stay code.
 */
function escapeLineStart(text: string): string {
  return (
    text
      .replace(/^(\s*)([#>*+-])/gm, '$1\\$2')
      // A digit can't be backslash-escaped in Markdown; the dot after it can.
      .replace(/^(\s*\d+)([.)])/gm, '$1\\$2')
  )
}

function localDay(iso: string): string {
  return todayKey(new Date(iso))
}

/** Newest first, grouped by the day each suggestion was made. */
export function buildMarkdown(entries: DailyEntry[], now = new Date()): string {
  const written = entries.filter((entry): entry is DailyEntry & { suggestion: string } =>
    Boolean(entry.suggestion)
  )
  const done = written.filter((entry) => entry.done).length
  const lines = [
    '# Career App — suggestion history',
    '',
    `Exported ${todayKey(now)} · ${written.length} ${written.length === 1 ? 'suggestion' : 'suggestions'} · ${done} done`,
    ''
  ]

  let day = ''
  for (const entry of written) {
    if (entry.date !== day) {
      day = entry.date
      lines.push(`## ${day}`, '')
    }
    lines.push(`### ${entry.interestTitle}`, '')
    lines.push(entry.done ? `*Done${entry.doneAt ? ` on ${localDay(entry.doneAt)}` : ''}*` : '*Not done*', '')
    lines.push(escapeLineStart(entry.suggestion), '')
    if (entry.note) lines.push(`> ${entry.note}`, '')

    if (entry.explanation) {
      lines.push('**Step by step**', '')
      entry.explanation.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`))
      lines.push('')
      if (entry.explanation.concepts.length > 0) {
        lines.push('**Key concepts**', '')
        for (const concept of entry.explanation.concepts) {
          lines.push(`- **${concept.term}**: ${concept.definition}`)
        }
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

/** Where the last export went, so "Show in folder" never needs a path from the renderer. */
let lastExport: string | null = null

export async function exportHistory(window: BrowserWindow | null): Promise<ExportResult> {
  const view = await getDaily()
  const entries = [...(view.today?.suggestion ? [view.today] : []), ...view.history]
  if (entries.length === 0) throw new Error('There are no suggestions to export yet.')

  const options = {
    title: 'Export history',
    defaultPath: join(app.getPath('documents'), `career-app-history-${todayKey()}.md`),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  }
  const choice = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  if (choice.canceled || !choice.filePath) return { saved: false, fileName: null }

  await fs.writeFile(choice.filePath, buildMarkdown(entries), 'utf-8')
  lastExport = choice.filePath
  return { saved: true, fileName: basename(choice.filePath) }
}

/** Opens Explorer with the last exported file selected. */
export function revealLastExport(): void {
  if (lastExport) shell.showItemInFolder(lastExport)
}
