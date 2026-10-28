import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const SESSION_MS = 8 * 3600000
const ATTEMPT_WINDOW_MS = 60000
const MAX_ATTEMPTS = 10
const digest = (value: string) => createHash('sha256').update(value).digest()

/** 独立于下载凭据；重启或更换密码后，内存会话全部失效。 */
export class SeeAuth {
  private readonly passwordHash: Buffer
  private readonly sessions = new Map<string, number>()
  private attempts: number[] = []
  readonly cookieName: string

  constructor(password: string, private readonly secure: boolean, private readonly now = Date.now) {
    this.passwordHash = digest(password)
    this.cookieName = secure ? '__Secure-keep_see' : 'keep_see'
  }

  private token(cookie = '') {
    const values = cookie.split(';').map(part => part.trim()).filter(part => part.startsWith(this.cookieName + '='))
    if (values.length !== 1) return undefined
    const value = values[0].slice(this.cookieName.length + 1)
    return /^[a-f0-9]{64}$/.test(value) ? digest(value).toString('hex') : undefined
  }

  authorized(cookie?: string) {
    const token = this.token(cookie)
    if (!token) return false
    const expires = this.sessions.get(token)
    if (expires !== undefined && expires > this.now()) return true
    this.sessions.delete(token)
    return false
  }

  /** 全局小额度不信任 X-Forwarded-For，避免伪造地址绕过反代后的限流。 */
  reserveAttempt() {
    const now = this.now()
    this.attempts = this.attempts.filter(at => at > now - ATTEMPT_WINDOW_MS)
    if (this.attempts.length >= MAX_ATTEMPTS) return Math.max(1, Math.ceil((this.attempts[0] + ATTEMPT_WINDOW_MS - now) / 1000))
    this.attempts.push(now)
    return 0
  }

  matches(password: string) {
    return timingSafeEqual(this.passwordHash, digest(password))
  }

  login(oldCookie?: string) {
    this.logout(oldCookie)
    const now = this.now()
    for (const [token, expires] of this.sessions) if (expires <= now) this.sessions.delete(token)
    while (this.sessions.size >= 16) this.sessions.delete(this.sessions.keys().next().value!)
    const token = randomBytes(32).toString('hex')
    this.sessions.set(digest(token).toString('hex'), now + SESSION_MS)
    return this.cookie(token, SESSION_MS / 1000)
  }

  logout(cookie?: string) {
    const token = this.token(cookie)
    if (token) this.sessions.delete(token)
    return this.cookie('', 0)
  }

  private cookie(token: string, maxAge: number) {
    return `${this.cookieName}=${token}; Path=/see; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` + (this.secure ? '; Secure' : '')
  }

  close() { this.sessions.clear() }
}
