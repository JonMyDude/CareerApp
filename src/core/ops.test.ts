import assert from 'node:assert/strict'
import { test } from 'node:test'
import { IPC } from '../shared/ipc.ts'
import type { DailyView, Interest, SettingsInfo } from '../shared/types.ts'
import { memoryDocs, setDocs } from './docs.ts'
import { runOp } from './ops.ts'

/** Gemini, faked: every call returns the same suggestion and counts tokens. */
function fakeGemini(): { calls: string[] } {
  const calls: string[] = []
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push(String(url))
    assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-key')
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'Read one chapter of the Rust book.' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
    })
  }) as typeof fetch
  return { calls }
}

test('the cloud operations, end to end on in-memory storage', async () => {
  const store = memoryDocs()
  setDocs(store)
  const gemini = fakeGemini()

  // No key yet: Daily says so instead of calling out.
  const interest = await runOp(IPC.interestsCreate, [{ title: 'Rust', importance: 3 }]) as Interest
  assert.equal(((await runOp(IPC.dailyGet, [])) as DailyView).state, 'no-api-key')

  await runOp(IPC.settingsSetApiKey, ['test-key'])
  const settings = (await runOp(IPC.settingsGet, [])) as SettingsInfo
  assert.equal(settings.hasApiKey, true)
  assert.ok(!JSON.stringify(settings).includes('test-key'), 'settings:get must never return the key')

  const view = (await runOp(IPC.dailyGenerate, [])) as DailyView
  assert.equal(view.today?.interestId, interest.id)
  assert.equal(view.today?.suggestion, 'Read one chapter of the Rust book.')
  assert.deepEqual(view.drawn, [interest.id])
  assert.equal(gemini.calls.length, 1)

  // Cached for the day: a second generate makes no call.
  await runOp(IPC.dailyGenerate, [])
  assert.equal(gemini.calls.length, 1)

  const done = (await runOp(IPC.dailySetDone, [view.today!.id, true])) as DailyView
  assert.equal(done.today?.done, true)
  assert.match(String(await runOp(IPC.exportMarkdown, [])), /Read one chapter of the Rust book\./)

  // The import never overwrites: the cloud has data now.
  await assert.rejects(runOp(IPC.dataImport, [{ interests: { version: 1, interests: [] } }]), /already has data/)
  await assert.rejects(runOp('no:such-op', []), /Unknown operation/)
})

test('a first upload fills an empty cloud, and a key already there wins', async () => {
  const store = memoryDocs()
  setDocs(store)
  await runOp(IPC.settingsSetApiKey, ['cloud-key'])

  const interests = { version: 1, interests: [{ id: 'a', title: 'Go', notes: '', importance: 2, createdAt: '', updatedAt: '' }] }
  const result = (await runOp(IPC.dataImport, [
    { interests, settings: { geminiApiKey: 'desktop-key', model: 'gemini-x' }, bogus: { x: 1 } }
  ])) as { imported: string[] }

  assert.deepEqual(result.imported, ['interests', 'settings'])
  assert.equal(((await runOp(IPC.interestsList, [])) as Interest[])[0].title, 'Go')
  assert.equal((store.store.get('settings') as Record<string, unknown>).geminiApiKey, 'cloud-key')
  assert.equal((store.store.get('settings') as Record<string, unknown>).model, 'gemini-x')
  assert.equal(store.store.has('bogus'), false)
})
