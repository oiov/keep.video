import dns from 'node:dns/promises'
import net from 'node:net'

export function isAllowedOrigin(origin: string | undefined, expected: string | undefined): boolean {
  if (!origin || !expected) return false
  try { return new URL(origin).origin === new URL(expected).origin } catch { return false }
}

export function isPublicAddress(address: string): boolean {
  // 出站只使用公网 IPv4，拒绝 IPv6 映射和过渡地址绕过。
  if (net.isIP(address) !== 4) return false
  const [a, b] = address.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0, 168].includes(b) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19, 51].includes(b) || a === 203 && b === 0)
}

export async function publicTarget(input: string) {
  const url = new URL(input)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port && !['80', '443'].includes(url.port)) throw new Error('仅支持公开 HTTP/HTTPS 视频链接')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true, family: 4 })
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('不允许访问非公网地址')
  return { url, address: addresses[0].address }
}
