/**
 * Electron wraps anything thrown in an ipcMain handler as
 *   "Error invoking remote method 'daily:generate': Error: <our message>"
 * Strip the plumbing so the user sees only the message we wrote.
 */
const IPC_WRAPPER = /^Error invoking remote method '[^']*':\s*(?:[A-Za-z]*Error:\s*)?/

export function ipcErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong.'
  const cleaned = error.message.replace(IPC_WRAPPER, '').trim()
  return cleaned || 'Something went wrong.'
}
