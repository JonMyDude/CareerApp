import { readConfig } from './config'

/**
 * Calls the cloud (src/worker) — every data operation the desktop makes goes
 * through here. The service token in config.json gets it past Cloudflare
 * Access; the time zone makes "today" this computer's today.
 */

/** A Gemini call can take 45 s and is retried twice, so allow for all of it. */
const TIMEOUT_MS = 150_000

export async function remote<T>(channel: string, ...args: unknown[]): Promise<T> {
  const { cloud } = await readConfig()
  if (!cloud.url) throw new Error('Not connected to the cloud yet. Open Settings → Cloud.')

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-time-zone': Intl.DateTimeFormat().resolvedOptions().timeZone
  }
  if (cloud.clientId && cloud.clientSecret) {
    headers['CF-Access-Client-Id'] = cloud.clientId
    headers['CF-Access-Client-Secret'] = cloud.clientSecret
  }

  let response: Response
  try {
    response = await fetch(`${cloud.url}/api/${encodeURIComponent(channel)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ args }),
      // Access answers a refused token with a redirect to its login page.
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('The cloud took too long to answer. Try again.')
    }
    throw new Error("Couldn't reach the cloud. Check your internet connection.")
  }

  if (response.status >= 300 && response.status < 400) {
    throw new Error('Cloudflare Access refused this computer. Check the service token in Settings → Cloud.')
  }
  const body = (await response.json().catch(() => null)) as { result?: T; error?: string } | null
  if (!response.ok || !body) {
    throw new Error(body?.error ?? `The cloud answered HTTP ${response.status}.`)
  }
  return body.result as T
}
