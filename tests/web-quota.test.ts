import { describe, expect, it } from 'vitest'
import { quotaRetryAt } from '../docker/server/quota'
import { readConfig } from '../docker/server/config'

describe('在线会话滚动额度', () => {
  it('跨小时边界不清零，返回真正释放额度的时间', () => {
    const hour = 3600000, now = 5 * hour
    expect(quotaRetryAt([now - 100, now - 50], [{ duration: hour, limit: 2 }], now)).toBe(now - 100 + hour)
    expect(quotaRetryAt([now - hour, now - 50], [{ duration: hour, limit: 2 }], now)).toBe(now)
    expect(quotaRetryAt([now], [{ duration: hour, limit: 2 }], now)).toBe(now)
  })
  it('日额度独立生效，调小配额后等待足够多的记录过期', () => {
    const hour = 3600000, now = 48 * hour
    const windows = [{ duration: hour, limit: 2 }, { duration: 24 * hour, limit: 3 }]
    expect(quotaRetryAt([now - 4 * hour, now - 3 * hour, now - 2 * hour], windows, now)).toBe(now + 20 * hour)
    expect(quotaRetryAt([now - 200, now - 100, now - 50], [{ duration: hour, limit: 2 }], now)).toBe(now + hour - 100)
  })
})

describe('统计环境配置', () => {
  it('非本地站点漏填环境时明确失败，不猜测为生产或开发', () => {
    expect(() => readConfig({ SITE_URL: 'https://example.com' })).toThrow(/ANALYTICS_ENVIRONMENT/)
    expect(readConfig({ SITE_URL: 'https://example.com', ANALYTICS_ENVIRONMENT: 'production' }).analyticsEnvironment).toBe('production')
    expect(readConfig({ SITE_URL: 'https://preview.example.com', ANALYTICS_ENVIRONMENT: 'test' }).analyticsEnvironment).toBe('test')
    expect(readConfig({ SITE_URL: 'http://[::1]:6080' }).analyticsEnvironment).toBe('development')
    expect(readConfig({}).analyticsEnvironment).toBe('development')
    expect(readConfig({ SITE_URL: 'https://example.com', ANALYTICS_ENABLED: '0' }).analyticsEnabled).toBe(false)
    expect(() => readConfig({ SITE_URL: 'https://localhost.example.com' })).toThrow(/ANALYTICS_ENVIRONMENT/)
  })
  it('额度默认值有效，非法额度不静默关闭保护', () => {
    expect(readConfig({})).toMatchObject({ parseHourlyLimit: 60, parseDailyLimit: 200, downloadDailyLimit: 30 })
    for (const value of ['0', '-1', '1.5', 'NaN']) expect(() => readConfig({ WEB_PARSE_HOURLY_LIMIT: value })).toThrow()
    expect(readConfig({ WEB_DOWNLOAD_DAILY_LIMIT: '12' }).downloadDailyLimit).toBe(12)
  })
})
