import type { AnalyticsEvent } from '../../shared/web-analytics'

export interface ReportOptions {
  from: string; to: string; asOf: string; timezone: string
  environment: string; includeTests: boolean; input: 'all' | 'example' | 'user_input' | 'unknown'
}
const rate = (n: number, d: number) => d ? Math.round(n / d * 10000) / 100 : null
function distribution(values: number[]) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b)
  return { n: ordered.length, medianMs: ordered.length ? (ordered[Math.floor((ordered.length - 1) / 2)] + ordered[Math.floor(ordered.length / 2)]) / 2 : null,
    p95Ms: ordered.length ? ordered[Math.ceil(ordered.length * .95) - 1] : null }
}

/** 所有转化率按创建批次追踪到 asOf；缺失事件单列，不推断为失败。 */
export function buildReport(input: AnalyticsEvent[], options: ReportOptions) {
  const from = Date.parse(options.from), to = Date.parse(options.to), asOf = Date.parse(options.asOf)
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(asOf) || from >= to || asOf < to) throw new Error('时间窗口无效，as-of 不得早于结束时间')
  new Intl.DateTimeFormat('en', { timeZone: options.timezone }).format()
  const seen = new Set<string>()
  let duplicates = 0
  const events = input.filter(e => {
    if (e.environment !== options.environment || !options.includeTests && e.test || Date.parse(e.at) > asOf) return false
    if (seen.has(e.id)) { duplicates++; return false }
    seen.add(e.id); return true
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const inWindow = (e: AnalyticsEvent) => Date.parse(e.at) >= from && Date.parse(e.at) < to
  const matchesInput = (e: AnalyticsEvent) => options.input === 'all' || e.input === options.input
  const windowEvents = events.filter(e => inWindow(e) && matchesInput(e))
  const cohort = (startName: string, endName: string) => {
    const allStarts = new Set(events.filter(e => e.name === startName && e.entityId).map(e => e.entityId))
    const starts = new Map(events.filter(e => e.name === startName && e.entityId && inWindow(e) && matchesInput(e)).map(e => [e.entityId!, e]))
    const ends = new Map(events.filter(e => e.name === endName && e.entityId).map(e => [e.entityId!, e]))
    const finished = [...starts.keys()].flatMap(id => ends.has(id) ? [ends.get(id)!] : [])
    const unfinished = [...starts.keys()].filter(id => !ends.has(id))
    const outcomes = Object.fromEntries(['success', 'completed', 'error', 'cancelled'].map(result => [result, finished.filter(e => e.result === result).length]))
    const orphanEnds = events.filter(e => e.name === endName && e.entityId && inWindow(e) && matchesInput(e) && !allStarts.has(e.entityId)).length
    return { starts, ends, finished, unfinished, outcomes, orphanEnds }
  }
  const parses = cohort('parse_requested', 'parse_finished'), jobs = cohort('job_created', 'job_finished')
  const started = new Set(events.filter(e => e.name === 'job_started').map(e => e.entityId))
  const views = events.filter(e => e.name === 'tool_view' && e.sessionId && inWindow(e))
  const sessions = new Set(views.map(event => event.sessionId!))
  const submittingSessions = new Set(events.filter(event => event.name === 'parse_requested' && inWindow(event) && event.input === 'user_input' && event.sessionId && sessions.has(event.sessionId)).map(event => event.sessionId!))
  const activatedSessions = new Set(events.filter(event => event.name === 'job_created' && inWindow(event) && event.input === 'user_input' && event.sessionId && sessions.has(event.sessionId) && jobs.ends.get(event.entityId!)?.result === 'completed').map(event => event.sessionId!))
  const deliveries = windowEvents.filter(event => event.name === 'file_delivery_finished')
  const transfers = deliveries.filter(event => event.method === 'GET')
  const failureCounts = (finished: AnalyticsEvent[]) => {
    const counts: Record<string, number> = {}
    for (const event of finished) if (event.result === 'error') {
      const code = event.code || 'unknown'
      counts[code] = (counts[code] || 0) + 1
    }
    return counts
  }
  const breakdown = (field: 'platform' | 'input' | 'language' | 'utm' | 'referrer') => {
    const groups = new Map<string, { value: string; created: number; completed: number; error: number; cancelled: number; unresolved: number }>()
    for (const [id, event] of jobs.starts) {
      const value = event[field]
      const group = groups.get(value) || { value, created: 0, completed: 0, error: 0, cancelled: 0, unresolved: 0 }
      group.created++
      const outcome = jobs.ends.get(id)?.result
      if (outcome === 'completed' || outcome === 'error' || outcome === 'cancelled') group[outcome]++
      else group.unresolved++
      groups.set(value, group)
    }
    return [...groups.values()].sort((a, b) => b.created - a.created || a.value.localeCompare(b.value))
  }
  const durationValues = (field: 'queueMs' | 'downloadMs' | 'uploadMs') => jobs.finished.flatMap(event => typeof event[field] === 'number' ? [event[field]!] : [])
  const conflicts = [...jobs.starts.values()].filter(event => event.utm !== 'direct_or_unknown' && event.referrer !== 'direct_or_unknown' && event.utm !== event.referrer).length

  return {
    metadata: { ...options, exportedAt: new Date().toISOString(), interval: '[from, to)', terminalCutoff: 'asOf' },
    coverage: {
      recordedEvents: events.length, windowEvents: windowEvents.length, duplicateEvents: duplicates,
      firstRecordedAt: events[0]?.at || null, lastRecordedAt: events.at(-1)?.at || null,
      siteVisitors: null, pageviews: null, visits: null, resourceCost: null,
      caveats: [
        '仅覆盖保留期内实际收到的事件；没有事件不代表没有访问或任务。',
        '站点访客、PV、访问次数来自 Umami，不能用本地匿名会话数替代。',
        '未收尾可能仍在执行，也可能缺少事件；不能自动计为成功或失败。',
        '同一浏览器会话可跨多次访问；此处不是人数或访问次数，也不与 Umami 身份关联。',
        'UTM 与 referrer 分开展示，来源差异不是渠道真实性的证明。',
        '交付字节是流经服务端响应管道的字节，不代表客户端已接收或保存。',
        '没有资源计量与单价，不计算费用；当前记录不能作为计费账本。',
      ],
    },
    parses: {
      accepted: parses.starts.size, finished: parses.finished.length, success: parses.outcomes.success, error: parses.outcomes.error,
      inProgressOrMissing: parses.unfinished.length, rejected: windowEvents.filter(event => event.name === 'parse_rejected').length,
      successRatePercent: rate(parses.outcomes.success, parses.finished.length),
      terminalWithoutStart: parses.orphanEnds, failures: failureCounts(parses.finished),
      duration: distribution(parses.finished.flatMap(event => typeof event.durationMs === 'number' ? [event.durationMs] : [])),
    },
    jobs: {
      created: jobs.starts.size, finished: jobs.finished.length, completed: jobs.outcomes.completed, error: jobs.outcomes.error, cancelled: jobs.outcomes.cancelled,
      queuedOrMissing: jobs.unfinished.filter(id => !started.has(id)).length,
      runningOrMissing: jobs.unfinished.filter(id => started.has(id)).length,
      completionRatePercent: rate(jobs.outcomes.completed, jobs.finished.length),
      terminalWithoutStart: jobs.orphanEnds, failures: failureCounts(jobs.finished),
      queue: distribution(durationValues('queueMs')), downloadAndMerge: distribution(durationValues('downloadMs')), upload: distribution(durationValues('uploadMs')),
    },
    usage: {
      toolViews: views.length, measuredSessions: sessions.size, realInputSessions: submittingSessions.size, activatedSessions: activatedSessions.size,
      usageRatePercent: rate(submittingSessions.size, sessions.size), activationRatePercent: rate(activatedSessions.size, sessions.size),
      inputFilter: 'user_input',
      note: '分母为窗口内有 tool_view 的自有匿名会话；分子只取同窗口接受的真实链接解析或创建的真实链接任务，任务结果追踪至 asOf。',
    },
    delivery: {
      saveClicks: windowEvents.filter(event => event.name === 'file_save_clicked').length, requests: deliveries.length,
      headRequests: deliveries.filter(event => event.method === 'HEAD').length,
      completedFullResponses: transfers.filter(event => event.status === 200 && event.result === 'completed').length,
      completedRangeResponses: transfers.filter(event => event.status === 206 && event.result === 'completed').length,
      abortedResponses: transfers.filter(event => event.result === 'aborted').length,
      errorResponses: transfers.filter(event => event.result === 'error').length,
      streamedBytes: transfers.reduce((sum, event) => sum + (event.bytes || 0), 0),
      note: '按响应发生窗口统计，不是任务完成率；多个 Range、重复保存和 HEAD 不合并成成功文件数。',
    },
    attributionDifferences: conflicts,
    breakdown: { platform: breakdown('platform'), input: breakdown('input'), language: breakdown('language'), utm: breakdown('utm'), referrer: breakdown('referrer') },
  }
}
