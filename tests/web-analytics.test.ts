import { describe, it, expect } from 'vitest'
import { cleanContext, sourceCategory, platformCategory, type AnalyticsEvent } from '../shared/web-analytics'
import { webErrorCode, webErrorKey, WebError } from '../shared/web-errors'
import { buildReport } from '../docker/server/report'

const options = { from: '2026-10-23T00:00:00+08:00', to: '2026-10-24T00:00:00+08:00', asOf: '2026-10-25T00:00:00+08:00', timezone: 'Asia/Shanghai', environment: 'production', includeTests: false, input: 'all' as const }
const event = (name: AnalyticsEvent['name'], entityId: string, fields: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({
  ...cleanContext(), v: 1, id: name + ':' + entityId, name, entityId, at: '2026-10-23T12:00:00+08:00', environment: 'production', client: 'web', ...fields,
})

describe('网页统计口径', () => {
  it('来源与平台按域名边界匹配，缺失不推断为搜索，白名单丢弃敏感字段', () => {
    expect(sourceCategory('')).toBe('direct_or_unknown')
    expect(sourceCategory('https://chatgpt.com/share/secret')).toBe('chatgpt')
    expect(sourceCategory('chatgpt.com.attacker.example')).toBe('other')
    expect(sourceCategory('https://www.google.com/search?q=secret')).toBe('search')
    expect(platformCategory('https://notyoutube.com/watch?v=secret')).toBe('other')
    expect(platformCategory('https://youtu.be/secret')).toBe('youtube')
    const context = cleanContext({ sessionId: 'credential', url: 'secret', title: 'secret', utm: 'chatgpt', referrer: 'search', test: 'true', input: 'forged' })
    expect(context).not.toHaveProperty('sessionId')
    expect(context).not.toHaveProperty('url')
    expect(context).not.toHaveProperty('title')
    expect(context).toMatchObject({ utm: 'chatgpt', referrer: 'search', test: false, input: 'unknown' })
  })
  it('错误只返回安全类别，登录限制不被统一错误覆盖', () => {
    expect(webErrorCode(new Error('Sign in; https://private.example/?token=secret'))).toBe('authentication')
    expect(webErrorCode(new WebError('busy', 'secret'))).toBe('busy')
    expect(webErrorCode({ message: '[[deps-missing:yt-dlp]]未找到可用的 yt-dlp' })).toBe('runtime-unavailable')
    expect(webErrorCode({ message: '[[deps-missing:ffmpeg]]未找到可用的 ffmpeg' })).toBe('runtime-unavailable')
    expect(webErrorKey('authentication')).toBe('web.parse.authentication')
    expect(webErrorKey('secret')).toBe('web.requestFailed')
  })
  it('按创建批次追踪跨日结果、去重、排除测试，不把缺失终态算失败', () => {
    const rows = [
      event('tool_view', 'view', { sessionId: 'session' }),
      event('parse_requested', 'parse', { sessionId: 'session', input: 'user_input' }),
      event('parse_finished', 'parse', { result: 'success', durationMs: 12 }),
      event('job_created', 'one', { sessionId: 'session', input: 'user_input', utm: 'chatgpt', referrer: 'search' }),
      event('job_finished', 'one', { result: 'completed', at: '2026-10-24T02:00:00+08:00', queueMs: 4, downloadMs: 20, uploadMs: 6 }),
      event('job_created', 'two'), event('job_finished', 'two', { result: 'cancelled', queueMs: 8 }),
      event('job_created', 'three'), event('job_started', 'three'), event('job_created', 'four'),
      event('job_created', 'old', { at: '2026-10-22T12:00:00+08:00' }), event('job_finished', 'old', { result: 'completed' }),
      event('job_created', 'test', { test: true }), event('job_finished', 'test', { test: true, result: 'completed' }),
      event('job_created', 'dev', { environment: 'development' }),
    ]
    const report = buildReport([...rows, rows[4]], options)
    expect(report.jobs).toMatchObject({ created: 4, finished: 2, completed: 1, cancelled: 1, error: 0, queuedOrMissing: 1, runningOrMissing: 1, completionRatePercent: 50 })
    expect(report.jobs.queue).toMatchObject({ n: 2, medianMs: 6, p95Ms: 8 })
    expect(report.coverage.duplicateEvents).toBe(1)
    expect(report.attributionDifferences).toBe(1)
    expect(report.usage).toMatchObject({ measuredSessions: 1, realInputSessions: 1, activatedSessions: 1 })
    expect(buildReport(rows, { ...options, asOf: options.to }).jobs.completed).toBe(0)
    expect(buildReport(rows, { ...options, input: 'example' }).usage.activatedSessions).toBe(1)
  })
  it('多次 Range 与 HEAD 不充当完整文件，空分母保留未知', () => {
    const report = buildReport([
      event('file_delivery_finished', 'a', { method: 'GET', status: 206, result: 'completed', bytes: 4 }),
      event('file_delivery_finished', 'b', { method: 'GET', status: 206, result: 'completed', bytes: 6 }),
      event('file_delivery_finished', 'c', { method: 'HEAD', status: 200, result: 'completed', bytes: 0 }),
      event('file_delivery_finished', 'd', { method: 'GET', status: 200, result: 'aborted', bytes: 3 }),
    ], options)
    expect(report.delivery).toMatchObject({ requests: 4, completedFullResponses: 0, completedRangeResponses: 2, headRequests: 1, streamedBytes: 13, abortedResponses: 1 })
    expect(report.jobs.completionRatePercent).toBeNull()
    expect(report.coverage.siteVisitors).toBeNull()
  })
})
