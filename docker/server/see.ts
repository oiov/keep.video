import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Config } from './config'
import { SeeAuth } from './see-auth'
import { SeeError, SeeReports, seeFilter } from './see-report'
import { dashboardPage, errorPage, loginPage } from './see-page'
import { seeStyle } from './see-style'
import { t } from '../../src/i18n/see'

function passwordBody(req: IncomingMessage) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/x-www-form-urlencoded' || req.headers['content-encoding']) throw new SeeError(400, 'invalidRequest')
  if (Number(req.headers['content-length'] || 0) > 4096) throw new SeeError(413, 'invalidRequest')
  return new Promise<string>((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    const cleanup = () => {
      clearTimeout(timer)
      req.off('data', data); req.off('end', end); req.off('error', failed); req.off('aborted', failed)
    }
    const fail = (error: SeeError) => { cleanup(); req.pause(); reject(error) }
    const failed = () => fail(new SeeError(400, 'invalidRequest'))
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > 4096) { fail(new SeeError(413, 'invalidRequest')); return }
      chunks.push(chunk)
    }
    const end = () => {
      cleanup()
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
      const password = form.get('password')
      if (form.size !== 1 || password === null || Buffer.byteLength(password) > 1024) reject(new SeeError(400, 'invalidRequest'))
      else resolve(password)
    }
    const timer = setTimeout(() => fail(new SeeError(408, 'timeout')), 5000)
    timer.unref()
    req.on('data', data); req.once('end', end); req.once('error', failed); req.once('aborted', failed)
  })
}

export function createSee(config: Config, root: string, reports = new SeeReports(config, root)) {
  const auth = new SeeAuth(config.seePassword, config.origin.startsWith('https:'))
  let closed = false
  return {
    async handle(req: IncomingMessage, res: ServerResponse, url: URL) {
      if (url.pathname !== '/see' && !url.pathname.startsWith('/see/')) return false
      res.setHeader('Cache-Control', 'private, no-store, max-age=0')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      // no-referrer 会让浏览器原生 POST 表单的 Origin 变成 null，导致同源登录被误拒。
      res.setHeader('Referrer-Policy', 'same-origin')
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
      const send = (status: number, body = '', contentType = 'text/html; charset=utf-8') => {
        res.writeHead(status, { 'Content-Type': contentType })
        res.end(req.method === 'HEAD' ? undefined : body)
      }
      const redirect = () => { res.writeHead(303, { Location: '/see' }); res.end() }
      const json = url.pathname === '/see/report.json'
      try {
        if (!config.seePassword) { send(404); return true }
        if (closed) throw new SeeError(503, 'reportUnavailable')
        if (req.method === 'POST') {
          if (!['/see/login', '/see/logout'].includes(url.pathname)) { send(404); return true }
          // SameSite 之外再验证 Origin；缺少 Origin 的表单提交同样拒绝。
          if (req.headers.origin !== config.origin) throw new SeeError(403, 'forbidden')
          if (url.pathname === '/see/logout') {
            if (!auth.authorized(req.headers.cookie)) throw new SeeError(401, 'unauthorized')
            res.setHeader('Set-Cookie', auth.logout(req.headers.cookie))
            redirect(); return true
          }
          const retryAfter = auth.reserveAttempt()
          if (retryAfter) throw new SeeError(429, 'loginLimited', retryAfter)
          const password = await passwordBody(req)
          if (!auth.matches(password)) { send(401, loginPage('wrongPassword')); return true }
          if (closed) throw new SeeError(503, 'reportUnavailable')
          res.setHeader('Set-Cookie', auth.login(req.headers.cookie))
          redirect(); return true
        }
        if (!['GET', 'HEAD'].includes(req.method || '')) { res.setHeader('Allow', 'GET, HEAD'); send(405); return true }
        if (url.pathname === '/see/style.css') { send(200, seeStyle, 'text/css; charset=utf-8'); return true }
        if (!['/see', '/see/', '/see/report.json'].includes(url.pathname)) { send(404); return true }
        if (!auth.authorized(req.headers.cookie)) {
          if (json) throw new SeeError(401, 'unauthorized')
          send(200, loginPage()); return true
        }
        const filter = seeFilter(url.searchParams)
        if (req.method === 'HEAD') { send(200, '', json ? 'application/json; charset=utf-8' : undefined); return true }
        const report = await reports.get(filter)
        // 报表生成期间用户可能已在另一个标签页退出，不能在请求结束时泄露快照。
        if (!auth.authorized(req.headers.cookie)) throw new SeeError(401, 'unauthorized')
        if (json) {
          res.setHeader('Content-Disposition', 'attachment; filename="keep-video-analytics.json"')
          send(200, JSON.stringify(report), 'application/json; charset=utf-8')
        } else send(200, dashboardPage(report, filter, config.analyticsEnabled))
      } catch (error) {
        const safe = error instanceof SeeError ? error : new SeeError(503, 'reportUnavailable')
        if (safe.retryAfter) res.setHeader('Retry-After', String(safe.retryAfter))
        if (req.method === 'POST') res.setHeader('Connection', 'close')
        send(safe.status, json ? JSON.stringify({ error: t(safe.key) }) : safe.status === 429 ? loginPage(safe.key, safe.retryAfter) : errorPage(safe.key, auth.authorized(req.headers.cookie), safe.retryAfter), json ? 'application/json; charset=utf-8' : undefined)
      }
      return true
    },
    async close() { closed = true; auth.close(); await reports.close() },
  }
}
