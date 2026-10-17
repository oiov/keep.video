import http from 'node:http'
import fs from 'node:fs'
import { isWebPage } from '../../shared/web-routes'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { WebSocketServer, WebSocket } from 'ws'
import { readConfig } from './config'
import { isAllowedOrigin } from './security'
import { startEgress } from './egress'
import { Jobs, type Job } from './jobs'
import { serveStatic } from './static'
import { parseRange } from './storage'

process.env.KEEP_WEB_MODE = '1'
const config = readConfig()
const root = process.env.APP_ROOT || process.cwd()
process.env.DOWNVID_DATA_DIR = config.dataDir
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
const egress = await startEgress()
const jobs = new Jobs(config, egress.url)
const sessions = new Map<string, number>()
const sessionFile = path.join(config.dataDir, 'web-sessions.json')
try { for (const [id, expiry] of JSON.parse(fs.readFileSync(sessionFile, 'utf8'))) if (expiry > Date.now()) sessions.set(id, expiry) } catch {}
function session(req: http.IncomingMessage) {
  const token = /(?:^|;\s*)keep_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]
  return token && (sessions.get(token) || 0) > Date.now() ? token : undefined
}
function saveSessions() {
  fs.writeFileSync(sessionFile + '.part', JSON.stringify([...sessions]))
  fs.renameSync(sessionFile + '.part', sessionFile)
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  const url = new URL(req.url || '/', config.origin)
  try {
    if (!['GET', 'HEAD'].includes(req.method || '')) { res.writeHead(405).end(); return }
    if (url.pathname === '/healthz') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, version })); return }
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Robots-Tag', 'noindex')
      const owner = session(req)
      if (!owner) { res.writeHead(401).end(); return }
      if (url.pathname.startsWith('/api/files/')) {
        const job = jobs.jobs.get(url.pathname.slice('/api/files/'.length))
        if (!job || job.owner !== owner || !job.file || Date.now() - job.createdAt > config.ttl) { res.writeHead(404).end(); return }
        try { parseRange(req.headers.range, job.file.size) } catch { res.writeHead(416, { 'Content-Range': 'bytes */' + job.file.size }).end(); return }
        const file = await jobs.storage.open(job.file, job.localPath!, req.headers.range)
        res.writeHead(file.contentRange ? 206 : 200, { 'Content-Type': 'application/octet-stream', 'Content-Length': file.size, 'Accept-Ranges': 'bytes', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(job.file.name), ...(file.contentRange ? { 'Content-Range': file.contentRange } : {}) })
        if (req.method === 'HEAD') { file.stream.destroy(); res.end(); return }
        await pipeline(file.stream, res)
        return
      }
      res.writeHead(404).end(); return
    }
    if (isWebPage(url.pathname) && !session(req)) {
      if (sessions.size > 10000) { res.writeHead(503).end(); return }
      const token = randomBytes(32).toString('hex')
      sessions.set(token, Date.now() + 30 * 86400000); saveSessions()
      res.setHeader('Set-Cookie', 'keep_session=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000' + (config.origin.startsWith('https:') ? '; Secure' : ''))
    }
    serveStatic(req, res, process.env.WEBSITE_DIST || path.join(root, 'website/dist'), process.env.DOWNVID_WEB_DIST || path.join(root, 'docker/dist-web'))
  } catch { if (!res.headersSent) res.writeHead(500); res.end() }
})

const sockets = new Map<WebSocket, string>()
const wss = new WebSocketServer({ server, path: '/api/ws', maxPayload: 32768, verifyClient: (info, done) => {
  const owner = session(info.req)
  done(!!owner && isAllowedOrigin(info.origin, config.origin) && [...sockets.values()].filter(value => value === owner).length < 5, 403)
} })
function send(owner: string, event: string, data: unknown) {
  for (const [ws, id] of sockets) if (id === owner && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event, data }))
}
jobs.on('progress', (owner, data) => send(owner, 'download:progress', data))
jobs.on('updated', owner => send(owner, 'history:updated', jobs.list(owner)))

wss.on('connection', (ws, req) => {
  const owner = session(req)!
  sockets.set(ws, owner)
  let requests = 0
  let windowStart = Date.now()
  const waiting = new Map<string, Set<number>>()
  const reply = (id: number, result?: unknown, error?: string) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id, result, error })) }
  const finished = (job: Job) => {
    if (job.owner !== owner) return
    for (const id of waiting.get(job.id) || []) reply(id, job.status === 'paused' ? { paused: true } : jobs.view(job), job.status === 'error' ? job.error : undefined)
    waiting.delete(job.id)
  }
  jobs.on('finished', finished)
  ws.on('close', () => { sockets.delete(ws); jobs.off('finished', finished) })
  ws.on('message', async raw => {
    let id = 0
    try {
      if (Date.now() - windowStart > 60000) { requests = 0; windowStart = Date.now() }
      if (++requests > 120) { ws.close(1008); return }
      const message = JSON.parse(String(raw))
      if (!Number.isSafeInteger(message.id) || !Array.isArray(message.args)) throw new Error('请求格式无效')
      id = message.id
      const args = message.args
      let result: unknown
      switch (message.channel) {
        case 'ytdlp:parse': result = await jobs.parse(owner, args[0]); break
        case 'ytdlp:download': {
          const job = jobs.submit(owner, args[0])
          if (job.status === 'completed') result = jobs.view(job)
          else { const ids = waiting.get(job.id) || new Set<number>(); ids.add(id); waiting.set(job.id, ids); return }
          break
        }
        case 'ytdlp:pauseDownload': result = await jobs.pause(owner, args[0]); break
        case 'history:get': result = jobs.list(owner); break
        case 'history:add': result = true; break
        case 'history:delete': await jobs.remove(owner, args[0]); send(owner, 'history:updated', jobs.list(owner)); result = true; break
        case 'app:getVersion': result = version; break
        case 'app:getDefaultDownloadDir': case 'dialog:selectFolder': result = '/downloads'; break
        case 'app:getHomeDir': result = ''; break
        case 'app:fetchImage': result = null; break
        case 'app:cookieStatus': result = { browsers: [], snapshot: null }; break
        case 'app:getDiskSpace': result = { free: config.maxFileBytes, total: config.maxFileBytes, unit: 'bytes' }; break
        case 'ytdlp:accelerationStatus': result = { available: false }; break
        case 'app:setUpdatePrefs': result = true; break
        case 'app:checkForUpdates': result = { hasUpdate: false, currentVersion: version, downloadUrl: '' }; break
        case 'deps:status': case 'deps:check': result = { success: true, status: { managedDir: '', checkedAt: Date.now(), results: [] } }; break
        default: throw new Error('此功能仅在桌面版可用')
      }
      reply(id, result)
    } catch { reply(id, undefined, '请求未完成，请检查链接、任务状态或稍后重试') }
  })
})
const cleanup = setInterval(() => {
  void jobs.cleanup()
  for (const [id, expiry] of sessions) if (expiry < Date.now()) sessions.delete(id)
  saveSessions()
}, 60000)
cleanup.unref()
await jobs.cleanup()
server.listen(config.port, config.host, () => console.log('Keep Video 网站服务已启动'))
export { server }
