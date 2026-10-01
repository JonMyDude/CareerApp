import { DurableObject } from 'cloudflare:workers'
import { setTimeZone } from '@shared/date'
import { setDocs } from '../core/docs'
import { runOp } from '../core/ops'
import { setFallbackApiKey } from '../core/settings'
import { verifyAccessToken } from './access'

/**
 * The cloud half of Career App: the web UI (static assets) and one API,
 * POST /api/<channel> with `{ args: [...] }`, answering `{ result }` or
 * `{ error }`. Both the browser and the desktop app talk to it.
 */

export interface Env {
  USER_DATA: DurableObjectNamespace<UserData>
  /** Optional Gemini key as a secret; one saved from Settings wins. */
  GEMINI_API_KEY?: string
  /** e.g. "yourteam.cloudflareaccess.com" — from Zero Trust → Settings. */
  ACCESS_TEAM_DOMAIN?: string
  /** The Access application's AUD tag. */
  ACCESS_AUD?: string
  /** "true" only in .dev.vars, for `wrangler dev` on localhost. */
  AUTH_DISABLED?: string
}

/**
 * All the data, in one Durable Object. Every request reaches this one instance,
 * which runs them in one isolate, so the per-document write queues in core
 * serialise every writer, exactly as they did in the desktop's main process.
 */
export class UserData extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    setDocs({
      read: async (name) => (await ctx.storage.get(name)) ?? null,
      write: (name, data) => ctx.storage.put(name, data)
    })
    setFallbackApiKey(env.GEMINI_API_KEY)
  }

  async call(channel: string, args: unknown[], timeZone: string | null): Promise<unknown> {
    // "Today" is the user's today, not UTC's. One user, so one zone at a time.
    setTimeZone(timeZone)
    return runOp(channel, args)
  }
}

function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

async function authorised(request: Request, env: Env): Promise<Response | null> {
  if (env.AUTH_DISABLED === 'true') return null
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return error('Cloudflare Access is not set up for this Worker yet. See README → Web version.', 503)
  }
  const token = request.headers.get('cf-access-jwt-assertion')
  const valid = await verifyAccessToken(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD })
  return valid ? null : error('Not signed in.', 401)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // Anything else is the web UI, served from the static assets.
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 })
    if (request.method !== 'POST') return error('Use POST.', 405)

    const denied = await authorised(request, env)
    if (denied) return denied

    let args: unknown[] = []
    try {
      const body = (await request.json()) as { args?: unknown }
      if (Array.isArray(body?.args)) args = body.args
    } catch {
      return error('The request body must be JSON.', 400)
    }

    const channel = decodeURIComponent(url.pathname.slice('/api/'.length))
    const stub = env.USER_DATA.get(env.USER_DATA.idFromName('user'))
    try {
      const result = await stub.call(channel, args, request.headers.get('x-time-zone'))
      return Response.json({ result: result ?? null })
    } catch (failure) {
      // The same readable message the desktop's IPC used to pass on.
      return error(failure instanceof Error ? failure.message : 'Something went wrong.', 400)
    }
  }
} satisfies ExportedHandler<Env>
