import { IPC } from '@shared/ipc'
import type { CloudConnection, CloudInfo, SettingsInfo, UploadResult } from '@shared/types'
import { readConfig, readRaw, updateRaw, userDataPath, writeCloudConnection } from './config'
import { readJson } from './jsonFile'
import { remote } from './remote'

/**
 * The desktop's link to the cloud: where it is, and the one-time upload of the
 * data files this computer kept before the cloud existed.
 */

/** Old file name → cloud document name. */
const DATA_FILES: Record<string, string> = {
  'interests.json': 'interests',
  'daily.json': 'daily',
  'questions.json': 'questions',
  'quiz-history.json': 'quiz-history',
  'usage.json': 'usage'
}

async function localFiles(): Promise<Record<string, unknown>> {
  const files: Record<string, unknown> = {}
  for (const [file, name] of Object.entries(DATA_FILES)) {
    const doc = await readJson(userDataPath(file))
    if (doc && typeof doc === 'object') files[name] = doc
  }
  return files
}

export async function getCloudInfo(): Promise<CloudInfo> {
  const { cloud, uploadedAt } = await readConfig()
  return {
    url: cloud.url,
    hasToken: Boolean(cloud.clientId && cloud.clientSecret),
    canUpload: !uploadedAt && Object.keys(await localFiles()).length > 0
  }
}

/** Save the connection, then prove it works with a harmless read. */
export async function setCloudConnection(connection: CloudConnection): Promise<CloudInfo> {
  await writeCloudConnection(connection)
  await remote<SettingsInfo>(IPC.settingsGet)
  return getCloudInfo()
}

/**
 * Send this computer's data files, and the Gemini key, model and budget from
 * its config.json, to the cloud. The cloud refuses if it already holds data,
 * so nothing there is ever overwritten. The files stay on disk as a backup;
 * the key is removed locally, since the desktop no longer uses it.
 */
export async function uploadLocalData(): Promise<UploadResult> {
  const files = await localFiles()
  const raw = await readRaw()
  files.settings = {
    geminiApiKey: raw.geminiApiKey,
    model: raw.model,
    dailyTokenBudget: raw.dailyTokenBudget
  }
  const result = await remote<UploadResult>(IPC.dataImport, files)
  await updateRaw((config) => {
    delete config.geminiApiKey
    delete config.model
    delete config.dailyTokenBudget
    config.uploadedAt = new Date().toISOString()
  })
  return result
}
