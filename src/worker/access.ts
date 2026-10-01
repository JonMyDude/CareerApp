/**
 * Checks the token Cloudflare Access adds to every request it lets through
 * (`Cf-Access-Jwt-Assertion`), for browsers and service tokens alike.
 *
 * Access already blocks strangers at the edge; this is the second lock. If
 * Access were ever switched off, or the Worker reached some other way, the API
 * would still refuse — the Gemini key and your data are behind it.
 *
 * Verified against Access's own signing keys (RS256), the application's AUD
 * tag, the team as issuer, and the expiry.
 */

export interface AccessConfig {
  /** e.g. "yourteam.cloudflareaccess.com" */
  teamDomain: string
  /** The Access application's "Application Audience (AUD) Tag". */
  aud: string
}

interface Jwk extends JsonWebKey {
  kid?: string
}

const CERTS_TTL_MS = 60 * 60 * 1000
let certs: { domain: string; keys: Jwk[]; fetchedAt: number } | null = null

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function decodeJson(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part))) as Record<string, unknown>
}

async function signingKeys(teamDomain: string, fetcher: typeof fetch, refresh: boolean): Promise<Jwk[]> {
  const fresh = certs && certs.domain === teamDomain && Date.now() - certs.fetchedAt < CERTS_TTL_MS
  if (fresh && !refresh) return certs!.keys
  const response = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`)
  if (!response.ok) throw new Error(`Access certs: HTTP ${response.status}`)
  const { keys } = (await response.json()) as { keys?: Jwk[] }
  certs = { domain: teamDomain, keys: Array.isArray(keys) ? keys : [], fetchedAt: Date.now() }
  return certs.keys
}

/** True only for a genuine, current Access token for this application. */
export async function verifyAccessToken(
  token: string | null,
  config: AccessConfig,
  fetcher: typeof fetch = fetch,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [headerPart, payloadPart, signaturePart] = parts

  let header: Record<string, unknown>
  let payload: Record<string, unknown>
  try {
    header = decodeJson(headerPart)
    payload = decodeJson(payloadPart)
  } catch {
    return false
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false

  // Access rotates its keys: an unknown kid gets one refetch before failing.
  let jwk = (await signingKeys(config.teamDomain, fetcher, false)).find((key) => key.kid === header.kid)
  if (!jwk) jwk = (await signingKeys(config.teamDomain, fetcher, true)).find((key) => key.kid === header.kid)
  if (!jwk) return false

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(signaturePart), signed)
  if (!valid) return false

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audience.includes(config.aud)) return false
  if (payload.iss !== `https://${config.teamDomain}`) return false
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return false
  return true
}

/** For tests: forget cached keys. */
export function clearAccessCache(): void {
  certs = null
}
