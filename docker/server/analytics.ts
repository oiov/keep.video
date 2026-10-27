import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { type AnalyticsContext, type AnalyticsEvent, type EventFields, type EventName } from '../../shared/web-analytics'
import { cleanEvent } from './analytics-event'
import { AnalyticsStore } from './analytics-store'
import type { Config } from './config'

/** 单进程、尽力记录；独立数据库、有界缓冲与短事务不能替代业务额度账本。 */
export class Analytics {
  private queue: AnalyticsEvent[] = []
  private writing?: Promise<void>
  private opening?: Promise<AnalyticsStore>
  private store?: AnalyticsStore
  private stopped = false
  private cancelled = false
  private retryAt = 0
  readonly health = { since: new Date().toISOString(), written: 0, dropped: 0, writeFailures: 0 }
  readonly directory: string
  constructor(private config: Config) { this.directory = path.join(config.dataDir, 'analytics') }

  record(name: EventName, context: Partial<AnalyticsContext> = {}, fields: EventFields = {}, stableId?: string) {
    if (!this.config.analyticsEnabled || this.stopped) return
    if (this.queue.length >= 1000 || Date.now() < this.retryAt) { this.health.dropped++; return }
    const id = stableId && /^[a-f0-9-]{36}:(created|started|finished)$/.test(stableId) ? stableId : randomUUID()
    const event = cleanEvent({ ...context, ...fields, v: 1, id, name, at: new Date().toISOString(), environment: this.config.analyticsEnvironment })
    if (!event) return
    this.queue.push(event)
    this.start()
  }
  private database(): Promise<AnalyticsStore> {
    if (this.cancelled) return Promise.reject(new Error('统计已停止'))
    if (this.store) return Promise.resolve(this.store)
    if (!this.opening) this.opening = Promise.resolve().then(async () => {
      const store = new AnalyticsStore(this.directory)
      try {
        await store.importLegacy(() => this.cancelled)
        if (this.cancelled) throw new Error('统计已停止')
        this.store = store
        return store
      } catch (error) { store.close(); throw error }
    }).finally(() => { this.opening = undefined })
    return this.opening
  }
  private start() {
    if (this.writing) return
    this.writing = this.drain().finally(() => { this.writing = undefined; if (this.queue.length && !this.cancelled) this.start() })
  }
  private async drain() {
    let pending = 0
    try {
      const store = await this.database()
      while (this.queue.length && !this.cancelled) {
        const batch = this.queue.splice(0, 100)
        pending = batch.length
        const result = store.append(batch, this.config.analyticsMaxDailyBytes)
        this.health.written += result.written
        this.health.dropped += result.dropped
        pending = 0
        if (this.queue.length) await new Promise(resolve => setTimeout(resolve, 0))
      }
      store.saveHealth(this.health)
    } catch {
      this.health.dropped += pending + this.queue.length
      this.queue = []
      this.health.writeFailures++
      this.retryAt = Date.now() + 30000
      console.warn('统计暂不可用，下载不受影响；部分事件可能缺失')
    }
  }
  async cleanup(now = Date.now()) {
    if (this.stopped || Date.now() < this.retryAt) return
    const cutoff = new Date(now - (this.config.analyticsRetentionDays - 1) * 86400000).toISOString().slice(0, 10)
    try { await (await this.database()).cleanup(cutoff) }
    catch {
      this.health.writeFailures++
      this.retryAt = Date.now() + 30000
      console.warn('统计清理或迁移失败，将稍后重试；下载不受影响')
    }
  }
  async flush() { while (this.writing) await this.writing }
  async close() {
    this.stopped = true
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([this.flush(), new Promise<void>(resolve => { timer = setTimeout(resolve, 2000); timer.unref() })])
    clearTimeout(timer)
    this.cancelled = true
    this.health.dropped += this.queue.length
    this.queue = []
    this.store?.close()
  }
}
