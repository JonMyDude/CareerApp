import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearAccessCache, verifyAccessToken } from './access.ts'

const config = { teamDomain: 'team.cloudflareaccess.com', aud: 'aud-123' }

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url')

/** A key pair, the JWKS Access would serve for it, and a signer. */
async function setup() {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' }
  const fetcher = (async () => Response.json({ keys: [jwk] })) as typeof fetch
  async function sign(payload: Record<string, unknown>, kid = 'k1'): Promise<string> {
    const body = `${encode({ alg: 'RS256', kid })}.${encode(payload)}`
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(body))
    return `${body}.${Buffer.from(signature).toString('base64url')}`
  }
  return { fetcher, sign }
}

const now = Date.now()
const good = { aud: ['aud-123'], iss: 'https://team.cloudflareaccess.com', exp: Math.floor(now / 1000) + 600 }

test('accepts a genuine token and refuses everything else', async () => {
  clearAccessCache()
  const { fetcher, sign } = await setup()
  const check = (token: string | null) => verifyAccessToken(token, config, fetcher, now)

  assert.equal(await check(await sign(good)), true)
  assert.equal(await check(null), false)
  assert.equal(await check('not.a.token'), false)
  assert.equal(await check(await sign({ ...good, aud: ['someone-else'] })), false)
  assert.equal(await check(await sign({ ...good, iss: 'https://evil.cloudflareaccess.com' })), false)
  assert.equal(await check(await sign({ ...good, exp: Math.floor(now / 1000) - 1 })), false)
  assert.equal(await check(await sign(good, 'unknown-kid')), false)

  // Signed by another key: same shape, wrong signature.
  const other = await setup()
  assert.equal(await check(await other.sign(good)), false)

  // A payload swapped under a valid signature.
  const [header, , signature] = (await sign(good)).split('.')
  assert.equal(await check(`${header}.${encode({ ...good, aud: ['aud-123', 'x'] })}.${signature}`), false)
})
