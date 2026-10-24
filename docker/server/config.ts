import path from 'node:path'

/** 只在服务端读取；存储凭据不会注入前端构建。 */
export function readConfig(env = process.env) {
  const positive = (name: string, fallback: number) => {
    const value = Number(env[name] || fallback)
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`配置 ${name} 必须为正整数`)
    return value
  }
  const storage = env.STORAGE_DRIVER || 'local'
  if (!['local', 'r2'].includes(storage)) throw new Error('STORAGE_DRIVER 仅支持 local 或 r2')
  const origin = new URL(env.SITE_URL || 'http://localhost:6080')
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash) throw new Error('SITE_URL 必须是站点源地址')
  const dataDir = path.resolve(env.DOWNVID_DATA_DIR || 'data/userdata')
  const analyticsEnvironment = env.ANALYTICS_ENVIRONMENT || 'development'
  if (!['production', 'development', 'test'].includes(analyticsEnvironment)) throw new Error('统计环境必须为 production、development 或 test')
  if (positive('ANALYTICS_RETENTION_DAYS', 30) > 30) throw new Error('统计原始事件最多保留 30 天')
  const workDir = path.resolve(env.DOWNVID_DOWNLOADS || 'data/downloads')
  const r2 = { endpoint: env.R2_ENDPOINT || '', bucket: env.R2_BUCKET || '', accessKeyId: env.R2_ACCESS_KEY_ID || '', secretAccessKey: env.R2_SECRET_ACCESS_KEY || '' }
  if (storage === 'r2') {
    if (Object.values(r2).some(value => !value)) throw new Error('R2 配置不完整')
    const endpoint = new URL(r2.endpoint)
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('R2_ENDPOINT 必须使用 HTTPS')
  }
  return { storage, origin: origin.origin, dataDir, workDir, r2,
    analyticsEnabled: env.ANALYTICS_ENABLED !== '0', analyticsEnvironment: analyticsEnvironment as 'production' | 'development' | 'test',
    analyticsRetentionDays: positive('ANALYTICS_RETENTION_DAYS', 30),
    analyticsMaxDailyBytes: positive('ANALYTICS_MAX_DAILY_MB', 16) * 1024 * 1024,
    port: positive('DOWNVID_WEB_PORT', 6080), host: env.DOWNVID_WEB_HOST || '127.0.0.1',
    concurrency: positive('WEB_CONCURRENCY', 3), maxQueued: positive('WEB_MAX_QUEUED', 30),
    maxSessionTasks: positive('WEB_SESSION_TASKS', 10), ttl: positive('FILE_TTL_HOURS', 24) * 3600000,
    taskTimeout: positive('TASK_TIMEOUT_MINUTES', 60) * 60000,
    maxFileBytes: positive('MAX_FILE_MB', 2048) * 1024 * 1024,
  }
}
export type Config = ReturnType<typeof readConfig>
