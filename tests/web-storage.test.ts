import { describe, it, expect } from 'vitest'
import { readConfig } from '../docker/server/config'
import { parseRange } from '../docker/server/storage'
import { isAllowedOrigin, isPublicAddress } from '../docker/server/security'
describe('服务端存储与访问边界', () => {
  it('默认本地，R2 必须明确提供完整配置', () => {
    expect(readConfig({}).storage).toBe('local')
    expect(() => readConfig({ STORAGE_DRIVER: 'r2' })).toThrow()
    expect(() => readConfig({ STORAGE_DRIVER: 'invalid' })).toThrow()
    expect(() => readConfig({ MAX_FILE_MB: '-1' })).toThrow()
    expect(readConfig({ STORAGE_DRIVER: 'r2', R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com', R2_BUCKET: 'media', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test' }).storage).toBe('r2')
  })
  it('处理尾部和开放范围，拒绝越界及多范围', () => {
    expect(parseRange('bytes=2-5', 10)).toEqual({ start: 2, end: 5 })
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 })
    expect(parseRange('bytes=7-', 10)).toEqual({ start: 7, end: 9 })
    expect(() => parseRange('bytes=10-', 10)).toThrow()
    expect(() => parseRange('bytes=1-2,4-5', 10)).toThrow()
  })
  it('拒绝无来源握手、私网和映射地址', () => {
    expect(isAllowedOrigin('https://keep.video', 'https://keep.video')).toBe(true)
    expect(isAllowedOrigin(undefined, 'https://keep.video')).toBe(false)
    expect(isAllowedOrigin('http://keep.video', 'https://keep.video')).toBe(false)
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.1.1', '169.254.169.254', '192.168.1.1', '::ffff:127.0.0.1']) expect(isPublicAddress(ip)).toBe(false)
    expect(isPublicAddress('1.1.1.1')).toBe(true)
  })
})
