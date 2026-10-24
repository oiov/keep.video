import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { cleanContext, eventNames, isOpaqueId, type AnalyticsContext, type AnalyticsEvent, type EventFields, type EventName } from '../../shared/web-analytics'
import { webErrorCodes } from '../../shared/web-errors'
import type { Config } from './config'

/** 单进程、尽力记录；有界缓冲与每日上限保护下载服务，不能用于计费。 */
export class Analytics {
  private queue: AnalyticsEvent[] = []
  private writing?: Promise<void>
  private stopped = false
  private retryAt = 0
  private day = ''
  private dayBytes = 0
  readonly health = { since: new Date().toISOString(), written: 0, dropped: 0, writeFailures: 0 }
  readonly directory: string
  constructor(private config: Config) { this.directory = path.join(config.dataDir, 'analytics') }

  record(name: EventName, context: Partial<AnalyticsContext> = {}, fields: EventFields = {}, stableId?: string) {
    if (!this.config.analyticsEnabled || this.stopped) return
    if (this.queue.length >= 1000 || Date.now() < this.retryAt) { this.health.dropped++; return }
    const event: AnalyticsEvent = { ...cleanContext(context), v: 1, id: randomUUID(), name, at: new Date().toISOString(), environment: this.config.analyticsEnvironment, client: 'web' }
    if (!eventNames.includes(name)) return
    if (stableId && /^[a-f0-9-]{36}:(created|started|finished)$/.test(stableId)) event.id = stableId
    for (const key of ['entityId', 'parseId'] as const) if (isOpaqueId(fields[key])) event[key] = fields[key]
    for (const key of ['durationMs', 'queueMs', 'downloadMs', 'uploadMs', 'bytes', 'status', 'rangeStart', 'rangeEnd'] as const) {
      const value = fields[key]
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) event[key] = value
    }
    if (fields.result && ['success', 'error', 'completed', 'cancelled', 'rejected', 'aborted'].includes(fields.result)) event.result = fields.result
    if (fields.phase && ['queued', 'downloading', 'merging', 'uploading'].includes(fields.phase)) event.phase = fields.phase
    if (fields.code && webErrorCodes.includes(fields.code)) event.code = fields.code
    if (fields.method === 'GET' || fields.method === 'HEAD') event.method = fields.method
    this.queue.push(event)
    this.start()
  }
  private start() {
    if (this.writing) return
    this.writing = this.drain().finally(() => { this.writing = undefined; if (this.queue.length) this.start() })
  }
  private async drain() {
    try {
      await fs.mkdir(this.directory, { recursive: true, mode: 0o700 })
      while (this.queue.length) {
        const date = this.queue[0].at.slice(0, 10)
        const count = this.queue.findIndex(event => !event.at.startsWith(date))
        const batch = this.queue.splice(0, count < 0 ? this.queue.length : count)
        const file = path.join(this.directory, date + '.jsonl')
        const text = '\n' + batch.map(event => JSON.stringify(event)).join('\n') + '\n'
        if (this.day !== date) {
          this.day = date
          this.dayBytes = await fs.stat(file).then(stat => stat.size, () => 0)
        }
        const bytes = Buffer.byteLength(text)
        if (this.dayBytes + bytes > this.config.analyticsMaxDailyBytes) { this.health.dropped += batch.length; continue }
        try { await fs.appendFile(file, text, { mode: 0o600 }) }
        catch { this.health.dropped += batch.length; throw new Error('统计写入失败') }
        this.dayBytes += bytes
        this.health.written += batch.length
      }
      await fs.writeFile(path.join(this.directory, 'health.json.part'), JSON.stringify(this.health), { mode: 0o600 })
      await fs.rename(path.join(this.directory, 'health.json.part'), path.join(this.directory, 'health.json'))
    } catch {
      this.health.dropped += this.queue.length
      this.queue = []
      this.health.writeFailures++
      this.retryAt = Date.now() + 30000
      console.warn('统计暂不可用，下载不受影响；部分事件可能缺失')
    }
  }
  async cleanup(now = Date.now()) {
    const cutoff = new Date(now - (this.config.analyticsRetentionDays - 1) * 86400000).toISOString().slice(0, 10)
    try {
      for (const name of await fs.readdir(this.directory)) {
        if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) && name.slice(0, 10) < cutoff) await fs.unlink(path.join(this.directory, name))
      }
    } catch { /* 统计清理失败不影响任务，下一轮重试。 */ }
  }
  async flush() { while (this.writing) await this.writing }
  async close() {
    this.stopped = true
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([this.flush(), new Promise<void>(resolve => { timer = setTimeout(resolve, 2000); timer.unref() })])
    clearTimeout(timer)
  }
}
