import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { openDatabase, ANALYTICS_DATABASE_ID, transaction } from './sqlite'
import { cleanEvent } from './analytics-event'
import type { AnalyticsEvent } from '../../shared/web-analytics'

const schema = `
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE imports (name TEXT PRIMARY KEY, malformed_lines INTEGER NOT NULL);
  CREATE TABLE days (day TEXT PRIMARY KEY, bytes INTEGER NOT NULL);
  CREATE TABLE events (
    seq INTEGER PRIMARY KEY, id TEXT NOT NULL, environment TEXT NOT NULL, at INTEGER NOT NULL,
    name TEXT NOT NULL, entity_id TEXT, test INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
    legacy_file TEXT, legacy_line INTEGER, UNIQUE(legacy_file, legacy_line)
  );
  CREATE INDEX events_time ON events(at);
  CREATE INDEX events_environment_time ON events(environment, at);
  CREATE INDEX events_identity ON events(environment, id, seq);
  CREATE INDEX events_entity ON events(environment, entity_id, at);
`

export class AnalyticsStore {
  readonly db
  private closed = false
  constructor(readonly directory: string) {
    this.db = openDatabase(path.join(directory, 'analytics.sqlite'), ANALYTICS_DATABASE_ID, schema, true)
  }
  private insert(event: AnalyticsEvent, file: string | null = null, line: number | null = null) {
    const payload = JSON.stringify(event)
    const result = this.db.prepare(`INSERT INTO events (id, environment, at, name, entity_id, test, payload, legacy_file, legacy_line)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(legacy_file, legacy_line) DO NOTHING`)
      .run(event.id, event.environment, Date.parse(event.at), event.name, event.entityId || null, Number(event.test), payload, file, line)
    if (result.changes) this.db.prepare('INSERT INTO days VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET bytes = bytes + excluded.bytes')
      .run(event.at.slice(0, 10), Buffer.byteLength(payload) + 1)
    return Number(result.changes)
  }
  async importLegacy(cancelled: () => boolean) {
    const names = (await fs.readdir(this.directory)).filter(name => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)).sort()
    for (const name of names) {
      if (cancelled()) throw new Error('统计迁移已停止')
      if (this.db.prepare('SELECT 1 FROM imports WHERE name = ?').get(name)) continue
      this.db.prepare("DELETE FROM metadata WHERE key = 'legacy-import-complete'").run()
      const input = createReadStream(path.join(this.directory, name))
      const lines = createInterface({ input, crlfDelay: Infinity })
      let number = 0, malformed = 0
      let batch: { event: AnalyticsEvent; line: number }[] = []
      const save = () => {
        transaction(this.db, () => { for (const row of batch) this.insert(row.event, name, row.line) })
        batch = []
      }
      try {
        for await (const line of lines) {
          if (cancelled()) throw new Error('统计迁移已停止')
          number++
          if (!line.trim()) continue
          let event: AnalyticsEvent | undefined
          try { event = cleanEvent(JSON.parse(line)) } catch {}
          if (!event) { malformed++; continue }
          batch.push({ event, line: number })
          if (batch.length >= 100) { save(); await new Promise(resolve => setTimeout(resolve, 0)) }
        }
        save()
        this.db.prepare('INSERT INTO imports VALUES (?, ?)').run(name, malformed)
      } finally { lines.close(); input.destroy() }
    }
    this.db.prepare("INSERT OR REPLACE INTO metadata VALUES ('legacy-import-complete', '1')").run()
  }
  append(events: AnalyticsEvent[], maxDailyBytes: number) {
    return transaction(this.db, () => {
      let written = 0, dropped = 0
      for (const event of events) {
        const dayBytes = Number(this.db.prepare('SELECT bytes FROM days WHERE day = ?').get(event.at.slice(0, 10))?.bytes || 0)
        const bytes = Buffer.byteLength(JSON.stringify(event)) + 1
        if (dayBytes + bytes > maxDailyBytes) { dropped++; continue }
        written += this.insert(event)
      }
      return { written, dropped }
    })
  }
  saveHealth(health: unknown) { this.db.prepare("INSERT OR REPLACE INTO metadata VALUES ('health', ?)").run(JSON.stringify(health)) }
  async cleanup(cutoff: string) {
    transaction(this.db, () => {
      this.db.prepare('DELETE FROM events WHERE at < ?').run(Date.parse(cutoff + 'T00:00:00Z'))
      this.db.prepare('DELETE FROM days WHERE day < ?').run(cutoff)
    })
    // 已迁移的原文件仍遵循原始事件保留期；业务 JSON 备份不在此清理。
    for (const name of await fs.readdir(this.directory)) {
      if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) && name.slice(0, 10) < cutoff) await fs.unlink(path.join(this.directory, name))
    }
  }
  close() { if (!this.closed) { this.db.close(); this.closed = true } }
}
