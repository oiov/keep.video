import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { buildReport, type ReportOptions, type ReportCoverage } from './report'
import { ANALYTICS_DATABASE_ID, openReadOnlyDatabase } from './sqlite'
import { cleanEvent } from './analytics-event'
import type { AnalyticsEvent } from '../../shared/web-analytics'

/** 先按环境、测试标记及截止时间筛选再去重，与旧报表的顺序一致。 */
const canonical = `WITH eligible AS (
  SELECT * FROM events WHERE environment = :environment AND at <= :asOf AND (:tests = 1 OR test = 0)
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY seq) AS rank FROM eligible
), canonical AS (SELECT * FROM ranked WHERE rank = 1)`

export async function readAnalyticsReport(directory: string, options: ReportOptions) {
  buildReport([], options)
  const file = path.join(directory, 'analytics.sqlite')
  try { await fs.stat(file) }
  catch (error: any) { if (error.code === 'ENOENT') return readLegacyReport(directory, options); throw error }
  const db = openReadOnlyDatabase(file, ANALYTICS_DATABASE_ID)
  try {
    db.exec('BEGIN')
    if (!db.prepare("SELECT 1 FROM metadata WHERE key = 'legacy-import-complete'").get()) throw new Error('统计迁移尚未完成，请等待服务完成迁移后重试')
    const parameters = { environment: options.environment, asOf: Date.parse(options.asOf), tests: Number(options.includeTests) }
    const bounds = { ...parameters, from: Date.parse(options.from), to: Date.parse(options.to) }
    const totals = db.prepare(`${canonical} SELECT COUNT(*) AS n, MIN(at) AS first, MAX(at) AS last,
      (SELECT COUNT(*) FROM eligible) - COUNT(*) AS duplicates FROM canonical`).get(parameters)!
    const environments = db.prepare(`SELECT environment, COUNT(DISTINCT id) AS n FROM events
      WHERE at >= :from AND at < :to AND (:tests = 1 OR test = 0) GROUP BY environment`)
      .all({ from: bounds.from, to: bounds.to, tests: bounds.tests })
    const coverage: ReportCoverage = { recordedEvents: Number(totals.n), duplicateEvents: Number(totals.duplicates),
      firstRecordedAt: totals.first === null ? null : new Date(Number(totals.first)).toISOString(),
      lastRecordedAt: totals.last === null ? null : new Date(Number(totals.last)).toISOString(),
      environmentEventsInWindow: Object.fromEntries(environments.map(row => [String(row.environment), Number(row.n)])) }
    // 不只取时间窗口：同时取关联实体的前置起点与跨日终态，避免误报孤儿或漏算交付。
    const rows = db.prepare(`${canonical}, entities AS (
      SELECT DISTINCT entity_id FROM canonical WHERE at >= :from AND at < :to AND entity_id IS NOT NULL
    ) SELECT payload FROM canonical WHERE (at >= :from AND at < :to)
      OR entity_id IN (SELECT entity_id FROM entities) ORDER BY seq`).all(bounds)
    const records: AnalyticsEvent[] = rows.map(row => JSON.parse(String(row.payload)))
    const health = db.prepare("SELECT value FROM metadata WHERE key = 'health'").get()
    const malformedLines = Number(db.prepare('SELECT COALESCE(SUM(malformed_lines), 0) AS n FROM imports').get()!.n)
    db.exec('COMMIT')
    return { report: buildReport(records, options, coverage), reader: { backend: 'sqlite', filesRead: 0, malformedLines,
      health: health ? JSON.parse(String(health.value)) : null,
      note: 'SQLite 只读一致性快照；health 只覆盖最近进程，入库前丢失和已过期事件仍可能造成统计缺口。' } }
  } finally { db.close() }
}

async function readLegacyReport(directory: string, options: ReportOptions) {
  const records: AnalyticsEvent[] = []
  let malformedLines = 0
  let files: string[] = []
  try { files = (await fs.readdir(directory)).filter(name => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)).sort() }
  catch (error: any) { if (error.code !== 'ENOENT') throw error }
  for (const file of files) {
    const input = createReadStream(path.join(directory, file))
    const lines = createInterface({ input, crlfDelay: Infinity })
    try {
      for await (const line of lines) {
        if (!line.trim()) continue
        let event: AnalyticsEvent | undefined
        try { event = cleanEvent(JSON.parse(line)) } catch {}
        if (event) records.push(event)
        else malformedLines++
      }
    } finally { lines.close(); input.destroy() }
  }
  let health: unknown = null
  try { health = JSON.parse(await fs.readFile(path.join(directory, 'health.json'), 'utf8')) } catch {}
  return { report: buildReport(records, options), reader: { backend: 'jsonl', filesRead: files.length, malformedLines, health,
    note: '兼容未迁移的 JSONL；缺失、过期、写入期间读取或异常退出均可能产生统计缺口。' } }
}
