import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { writeFileAtomic } from '../../electron/utils/atomic-file'
import { WebError } from '../../shared/web-errors'
import type { Config } from './config'

const HOUR = 3600000
const DAY = 24 * HOUR
const MAX_SESSIONS = 10000
type Action = 'parse' | 'download'
type Usage = Record<Action, number[]>

/** 滚动窗口而非自然日；返回可再次预留的时间，不对失败或取消退额。 */
export function quotaRetryAt(times: number[], windows: { duration: number; limit: number }[], now: number): number {
  return Math.max(now, ...windows.map(({ duration, limit }) => {
    const active = times.filter(at => at > now - duration).sort((a, b) => a - b)
    return active.length >= limit ? active[active.length - limit] + duration : now
  }))
}

/** 独立于遥测的业务额度；先落盘再执行，同一会话的重连、并发和重启共用预算。 */
export class SessionQuota {
  private usage = new Map<string, Usage>()
  private file: string
  constructor(private config: Config) {
    this.file = path.join(config.dataDir, 'web-usage.json')
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (data.v !== 1 || !Array.isArray(data.sessions) || data.sessions.length > MAX_SESSIONS) throw new Error()
      for (const entry of data.sessions) {
        if (!Array.isArray(entry) || entry.length !== 2) throw new Error()
        const [id, usage] = entry
        if (!/^[a-f0-9]{64}$/.test(id) || !usage || this.usage.has(id)) throw new Error()
        for (const action of ['parse', 'download'] as const) {
          if (!Array.isArray(usage[action]) || !usage[action].every((at: unknown) => Number.isSafeInteger(at) && Number(at) >= 0)) throw new Error()
        }
        this.usage.set(id, { parse: usage.parse, download: usage.download })
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw new Error('无法读取会话额度清单；请检查或恢复备份，不会自动清空额度')
    }
    this.cleanup()
  }
  consume(owner: string, action: Action, now = Date.now()) {
    const id = createHash('sha256').update(owner).digest('hex')
    const previous = this.usage.get(id)
    const usage: Usage = { parse: (previous?.parse || []).filter(at => at > now - DAY), download: (previous?.download || []).filter(at => at > now - DAY) }
    const windows = action === 'parse'
      ? [{ duration: HOUR, limit: this.config.parseHourlyLimit }, { duration: DAY, limit: this.config.parseDailyLimit }]
      : [{ duration: DAY, limit: this.config.downloadDailyLimit }]
    const retryAt = quotaRetryAt(usage[action], windows, now)
    if (retryAt > now) throw new WebError(action === 'parse' ? 'parse-quota' : 'download-quota', '会话累计额度已用完，请等待额度恢复', Math.ceil((retryAt - now) / 1000))
    if (!previous && this.usage.size >= MAX_SESSIONS) {
      this.cleanup(now)
      if (this.usage.size >= MAX_SESSIONS) throw new WebError('busy', '服务繁忙，请稍后重试')
    }
    usage[action].push(now)
    this.usage.set(id, usage)
    try { this.persist() }
    catch {
      if (previous) this.usage.set(id, previous)
      else this.usage.delete(id)
      throw new WebError('storage', '无法保存会话额度，请稍后重试')
    }
  }
  cleanup(now = Date.now()) {
    let changed = false
    for (const [id, usage] of this.usage) {
      const parse = usage.parse.filter(at => at > now - DAY), download = usage.download.filter(at => at > now - DAY)
      if (parse.length !== usage.parse.length || download.length !== usage.download.length) changed = true
      if (!parse.length && !download.length) { this.usage.delete(id); changed = true }
      else this.usage.set(id, { parse, download })
    }
    if (changed) this.persist()
  }
  private persist() { writeFileAtomic(this.file, JSON.stringify({ v: 1, sessions: [...this.usage] })) }
}
