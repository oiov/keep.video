/** 统计只接受枚举与数值；原始 URL、凭据、标题和错误输出不能进入事件。 */
export const EXAMPLE_URL = 'https://x.com/CaptainAmerica/status/719944021058060289'
export const sources = ['direct_or_unknown', 'chatgpt', 'search', 'social', 'internal', 'other'] as const
export const platforms = ['youtube', 'bilibili', 'tiktok', 'douyin', 'kuaishou', 'instagram', 'twitter', 'vimeo', 'facebook', 'pinterest', 'reddit', 'twitch', 'dailymotion', 'soundcloud', 'okru', 'vk', 'other', 'unknown'] as const
export const languages = ['en', 'zh-CN', 'es', 'pt-BR', 'de', 'fr', 'ja', 'ko', 'ru'] as const
export const eventNames = ['tool_view', 'example_selected', 'parse_rejected', 'parse_requested', 'parse_finished', 'job_rejected', 'job_created', 'job_started', 'job_stage', 'job_finished', 'file_save_clicked', 'file_delivery_finished'] as const
export type EventName = typeof eventNames[number]
export type Source = typeof sources[number]
export interface AnalyticsContext {
  sessionId?: string
  utm: Source
  referrer: Source
  language: typeof languages[number] | 'unknown'
  input: 'example' | 'user_input' | 'unknown'
  platform: typeof platforms[number]
  test: boolean
}
export interface EventFields {
  entityId?: string
  parseId?: string
  result?: 'success' | 'error' | 'completed' | 'cancelled' | 'rejected' | 'aborted'
  code?: string
  phase?: 'queued' | 'downloading' | 'merging' | 'uploading'
  durationMs?: number
  queueMs?: number
  downloadMs?: number
  uploadMs?: number
  bytes?: number
  status?: number
  rangeStart?: number
  rangeEnd?: number
  method?: 'GET' | 'HEAD'
}
export interface AnalyticsEvent extends AnalyticsContext, EventFields {
  v: 1
  id: string
  name: EventName
  at: string
  environment: 'production' | 'development' | 'test'
  client: 'web'
}
export const isOpaqueId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const member = <T extends string>(values: readonly T[], value: unknown, fallback: T): T => values.includes(value as T) ? value as T : fallback
export function cleanContext(raw: any = {}): AnalyticsContext {
  return {
    ...(isOpaqueId(raw?.sessionId) ? { sessionId: raw.sessionId } : {}),
    utm: member(sources, raw?.utm, 'direct_or_unknown'), referrer: member(sources, raw?.referrer, 'direct_or_unknown'),
    language: member([...languages, 'unknown'] as const, raw?.language, 'unknown'),
    input: member(['example', 'user_input', 'unknown'] as const, raw?.input, 'unknown'),
    platform: member(platforms, raw?.platform, 'unknown'), test: raw?.test === true,
  }
}
export function sourceCategory(value: string, ownHost = ''): Source {
  let host = value.trim().toLowerCase()
  if (!host) return 'direct_or_unknown'
  try { host = new URL(host.includes('://') ? host : 'https://' + host).hostname } catch { return 'other' }
  const matches = (domain: string) => host === domain || host.endsWith('.' + domain)
  if (ownHost && host === ownHost) return 'internal'
  if (matches('chatgpt.com') || matches('chat.openai.com') || host === 'chatgpt') return 'chatgpt'
  if (['google.com', 'bing.com', 'baidu.com', 'duckduckgo.com', 'yahoo.com', 'yandex.com'].some(matches) || ['google', 'bing', 'baidu'].includes(host)) return 'search'
  if (['x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com'].some(matches)) return 'social'
  return 'other'
}
export function platformCategory(raw: unknown): AnalyticsContext['platform'] {
  try {
    const url = new URL(String(raw))
    if (!['http:', 'https:'].includes(url.protocol)) return 'unknown'
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    const domains: Record<string, AnalyticsContext['platform']> = {
      'youtube.com': 'youtube', 'youtu.be': 'youtube', 'youtube-nocookie.com': 'youtube',
      'bilibili.com': 'bilibili', 'b23.tv': 'bilibili', 'tiktok.com': 'tiktok',
      'douyin.com': 'douyin', 'kuaishou.com': 'kuaishou', 'instagram.com': 'instagram',
      'x.com': 'twitter', 'twitter.com': 'twitter', 'vimeo.com': 'vimeo',
      'facebook.com': 'facebook', 'fb.watch': 'facebook', 'fb.com': 'facebook',
      'pinterest.com': 'pinterest', 'pin.it': 'pinterest', 'reddit.com': 'reddit', 'redd.it': 'reddit',
      'twitch.tv': 'twitch', 'dailymotion.com': 'dailymotion', 'dai.ly': 'dailymotion',
      'soundcloud.com': 'soundcloud', 'ok.ru': 'okru', 'vk.com': 'vk', 'vkvideo.ru': 'vk',
    }
    return Object.entries(domains).find(([domain]) => host === domain || host.endsWith('.' + domain))?.[1] || 'other'
  } catch { return 'unknown' }
}
