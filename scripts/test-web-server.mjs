// 真实服务回归：同域门户、会话隔离、私有文件、Range 和受限 RPC。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { WebSocket } from 'ws'
const root = path.resolve(import.meta.dirname, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'keep-web-'))
const port = 14000 + Math.floor(Math.random() * 10000)
const origin = 'http://127.0.0.1:' + port
const website = path.join(temp, 'website'), app = path.join(temp, 'app'), data = path.join(temp, 'data'), downloads = path.join(temp, 'downloads')
for (const dir of [website, app, data, downloads]) fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(website, 'index.html'), '<h1>Keep Video portal</h1>')
fs.writeFileSync(path.join(website, '404.html'), '<h1>Not found</h1>')
for (const prefix of ['', 'zh/', 'es/', 'pt-br/', 'de/', 'fr/', 'ja/', 'ko/', 'ru/']) {
  const dir = path.join(website, prefix, 'app')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Online video downloader</h1>')
}
fs.mkdirSync(path.join(app, 'assets'))
fs.writeFileSync(path.join(app, 'entry.js'), 'console.log("app")')
fs.writeFileSync(path.join(app, 'assets', 'test.js'), 'export default true')
const owner = 'a'.repeat(64), other = 'b'.repeat(64)
fs.writeFileSync(path.join(data, 'web-sessions.json'), JSON.stringify([[owner, Date.now() + 60000], [other, Date.now() + 60000]]))
const id = 'test-file'
const file = path.join(downloads, 'test.mp4'); fs.writeFileSync(file, '0123456789')
fs.writeFileSync(path.join(data, 'web-jobs.json'), JSON.stringify([{ id, owner, clientId: id, url: 'https://example.com/video', title: '测试文件', createdAt: Date.now(), status: 'completed', progress: 100, localPath: file, file: { key: id, name: 'test.mp4', size: 10, driver: 'local' } }]))
const child = spawn(process.execPath, ['--import', 'tsx', 'docker/server/index.ts'], { cwd: root, env: { ...process.env, TSX_TSCONFIG_PATH: 'docker/server/tsconfig.json', SITE_URL: origin, DOWNVID_WEB_HOST: '127.0.0.1', DOWNVID_WEB_PORT: String(port), DOWNVID_DATA_DIR: data, DOWNVID_DOWNLOADS: downloads, WEBSITE_DIST: website, DOWNVID_WEB_DIST: app, STORAGE_DRIVER: 'local' }, stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d)
const sockets = []
const request = (route, token, headers = {}) => fetch(origin + route, { headers: { ...(token ? { Cookie: 'keep_session=' + token } : {}), ...headers }, redirect: 'manual' })
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + '/healthz')).ok) { ready = true; break } } catch {}
    if (child.exitCode !== null) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(ready, output)
  assert.match(await (await request('/')).text(), /portal/)
  assert.equal((await request('/missing')).status, 404)
  assert.equal((await request('/app')).headers.get('location'), '/app/')
  assert.equal((await request('/en/guides/')).headers.get('location'), '/guides/')
  assert.equal((await request('/zh-cn/app/?x=1')).headers.get('location'), '/zh/app/?x=1')
  assert.equal((await request('/zh-cn')).headers.get('location'), '/zh/')
  const page = await request('/app/')
  assert.match(page.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  assert.equal(page.headers.get('x-robots-tag'), null)
  for (const prefix of ['zh', 'es', 'pt-br', 'de', 'fr', 'ja', 'ko', 'ru']) {
    const localized = await request('/' + prefix + '/app/')
    assert.equal(localized.status, 200)
    assert.match(localized.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
    assert.equal(localized.headers.get('x-robots-tag'), null)
    assert.equal((await request('/' + prefix + '/app?x=1')).headers.get('location'), '/' + prefix + '/app/?x=1')
  }
  assert.equal((await request('/unknown/app/')).status, 404)
  assert.equal((await request('/app/entry.js')).headers.get('content-type'), 'text/javascript')
  assert.equal((await request('/app/entry.js')).headers.get('cache-control'), 'no-cache')
  assert.equal((await request('/app/assets/test.js')).status, 200)
  assert.equal((await request('/api/files/' + id)).status, 401)
  assert.equal((await request('/api/files/' + id, other)).status, 404)
  const range = await request('/api/files/' + id, owner, { Range: 'bytes=2-5' })
  assert.equal(range.headers.get('x-robots-tag'), 'noindex'); assert.equal(range.status, 206); assert.equal(await range.text(), '2345')
  assert.equal((await request('/api/files/' + id, owner, { Range: 'bytes=30-' })).status, 416)
  const ws = new WebSocket(origin.replace('http', 'ws') + '/api/ws', { headers: { Origin: origin, Cookie: 'keep_session=' + owner } }); sockets.push(ws); await once(ws, 'open')
  let next = 0
  const invoke = (channel, ...args) => new Promise((resolve, reject) => {
    const id = ++next
    const receive = raw => { const msg = JSON.parse(String(raw)); if (msg.id !== id) return; ws.off('message', receive); msg.error ? reject(new Error(msg.error)) : resolve(msg.result) }
    ws.on('message', receive); ws.send(JSON.stringify({ id, channel, args }))
  })
  assert.equal((await invoke('history:get')).length, 1)
  await assert.rejects(invoke('app:clearLog'))
  await assert.rejects(invoke('ytdlp:parse', 'http://127.0.0.1/'))
  await assert.rejects(invoke('ytdlp:download', { url: 'https://example.com', taskId: 'x', outputDir: '/' }))
  const denied = new WebSocket(origin.replace('http', 'ws') + '/api/ws', { headers: { Origin: 'https://invalid.example', Cookie: 'keep_session=' + owner } }); sockets.push(denied)
  const response = await new Promise(resolve => { denied.on('unexpected-response', (_, res) => { resolve(res.statusCode); denied.terminate() }); denied.on('error', () => {}) })
  assert.equal(response, 403)
  console.log('单站点、会话、文件交付和 RPC 回归通过')
} finally {
  for (const ws of sockets) ws.terminate()
  child.kill(); await once(child, 'exit').catch(() => {})
  fs.rmSync(temp, { recursive: true, force: true })
}
