/**
 * Channel names, in one place so the clients and the cloud cannot drift apart.
 * Data channels double as the cloud API's routes: POST /api/<channel>.
 */
export const IPC = {
  interestsList: 'interests:list',
  interestsCreate: 'interests:create',
  interestsUpdate: 'interests:update',
  interestsRemove: 'interests:remove',
  dailyGet: 'daily:get',
  dailyGenerate: 'daily:generate',
  dailyReroll: 'daily:reroll',
  dailySetDone: 'daily:set-done',
  dailyRemove: 'daily:remove',
  dailyExplain: 'daily:explain',
  dailySetNote: 'daily:set-note',
  questionsGenerate: 'questions:generate',
  questionsMarkSeen: 'questions:mark-seen',
  questionsRecordAnswer: 'questions:record-answer',
  questionsStats: 'questions:stats',
  questionsMistakes: 'questions:mistakes',
  usageGet: 'usage:get',
  settingsGet: 'settings:get',
  settingsSetApiKey: 'settings:set-api-key',
  settingsUpdate: 'settings:update',
  frameSetTheme: 'frame:set-theme',
  exportHistory: 'export:history',
  exportReveal: 'export:reveal',
  /** Cloud: the history as Markdown text; each client saves it its own way. */
  exportMarkdown: 'export:markdown',
  /** Cloud: whether it holds any data yet, and a one-time upload of a desktop's files. */
  dataStatus: 'data:status',
  dataImport: 'data:import',
  /** Desktop only: where the cloud is and the credentials to reach it. */
  cloudGet: 'cloud:get',
  cloudSet: 'cloud:set',
  cloudUpload: 'cloud:upload',
  reminderTest: 'reminder:test',
  // Main → renderer events. The preload subscribes to these fixed names only.
  eventDailyChanged: 'event:daily-changed',
  eventNavigate: 'event:navigate'
} as const
