import { cleanContext, eventNames, isOpaqueId, type AnalyticsEvent } from '../../shared/web-analytics'
import { webErrorCodes } from '../../shared/web-errors'

/** 新事件与旧日志迁移共用白名单，不能把旧日志中的额外字段带入统计库。 */
export function cleanEvent(raw: any): AnalyticsEvent | undefined {
  if (!raw || raw.v !== 1 || !eventNames.includes(raw.name) || typeof raw.id !== 'string'
    || !/^[a-f0-9-]{36}(?::(?:created|started|finished))?$/i.test(raw.id)
    || !Number.isFinite(Date.parse(raw.at)) || !['production', 'development', 'test'].includes(raw.environment)) return undefined
  const event: AnalyticsEvent = { ...cleanContext(raw), v: 1, id: raw.id, name: raw.name,
    at: new Date(raw.at).toISOString(), environment: raw.environment, client: 'web' }
  for (const key of ['entityId', 'parseId'] as const) if (isOpaqueId(raw[key])) event[key] = raw[key]
  for (const key of ['durationMs', 'queueMs', 'downloadMs', 'uploadMs', 'bytes', 'status', 'rangeStart', 'rangeEnd'] as const) {
    if (typeof raw[key] === 'number' && Number.isSafeInteger(raw[key]) && raw[key] >= 0) event[key] = raw[key]
  }
  if (['success', 'error', 'completed', 'cancelled', 'rejected', 'aborted'].includes(raw.result)) event.result = raw.result
  if (['queued', 'downloading', 'merging', 'uploading'].includes(raw.phase)) event.phase = raw.phase
  if (webErrorCodes.includes(raw.code)) event.code = raw.code
  if (raw.method === 'GET' || raw.method === 'HEAD') event.method = raw.method
  return event
}
