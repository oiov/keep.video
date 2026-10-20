// 真实服务回归：同域门户、会话隔离、私有文件、Range 和受限 RPC。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once, EventEmitter } from 'node:events'
import { WebSocket } from 'ws'
import { loader } from './lib/load-source.mjs'
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
const request = (route, token, headers = {}) => fetch(origin + route, { headers: { ...(token ? { Cookie: 'keep_session=' + token } : {}), ...headers }, redirect: 'manual', signal: AbortSignal.timeout(5000) })
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + '/healthz', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break } } catch {}
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

async function jobChecks(sources = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keep-jobs-'))
  const pending = new Map()
  const starts = []
  let failStop = true, cache
  const load = loader({
    'docker/server/electron-shim.ts': { wsEventBus: new EventEmitter() },
    'docker/server/security.ts': { publicTarget: async () => {} },
    'docker/server/storage.ts': { createStorage: () => ({}) },
    'electron/parsers/ytdlp.ts': { parseWithYtdlp: async url => {
      const info = { title: '测试', formats: [{ formatId: 'mp4', hasAudio: true }] }
      cache.cacheParsedInfo(url, url, info, JSON.stringify({ id: 'same' }), [])
      return info
    } },
    'electron/download/ytdlp.ts': {
      runYtdlpDownload: options => { starts.push(options); return new Promise(resolve => pending.set(options.taskId, resolve)) },
      pauseDownload: async id => {
        if (failStop && pending.has(id)) throw new Error('模拟停止失败')
        pending.get(id)?.({ paused: true })
      },
    },
  }, { URL, setInterval, clearInterval, process: Object.assign(Object.create(process), { once: () => {} }) }, sources)
  cache = load('electron/parsers/info-cache.ts')
  const { Jobs } = load('docker/server/jobs.ts')
  const config = { ...load('docker/server/config.ts').readConfig({}), dataDir: dir, workDir: path.join(dir, 'work'), concurrency: 1 }
  const jobs = new Jobs(config, 'server-proxy')
  const firstUrl = 'https://example.com/one', secondUrl = 'https://example.com/two'
  try {
    const publicInfo = await jobs.parse('owner', firstUrl)
    assert.equal(publicInfo.cacheFile, undefined, '私有缓存路径不能交给浏览器')
    const raw = { taskId: 'one', url: firstUrl, formatId: 'mp4', outputDir: '/', proxy: 'client-proxy' }
    assert.throws(() => jobs.submit('other', raw), /重新解析/, '不能借用其他会话的解析结果')
    const first = jobs.submit('owner', raw)
    await jobs.parse('owner', secondUrl)
    const second = jobs.submit('owner', { ...raw, taskId: 'two', url: secondUrl })
    assert.equal(second.status, 'pending')
    assert.equal(starts.length, 1, '全局队列限制仍然生效')
    assert.equal(first.options.proxy, 'server-proxy')
    assert.equal(first.options.outputDir, path.join(config.workDir, first.id))
    const queuedFile = second.options.cacheFile
    for (let i = 0; i < cache.PARSE_CACHE_LIMIT + 1; i++) await jobs.parse('owner', 'https://example.com/' + i)
    assert.equal(jobs.parsed.size, cache.PARSE_CACHE_LIMIT, '服务解析索引有数量上限')
    assert.ok(fs.existsSync(queuedFile), '排队任务也持有缓存引用')
    await Promise.all([
      assert.rejects(jobs.pause('owner', 'one'), /模拟停止失败/),
      assert.rejects(jobs.pause('owner', 'one'), /模拟停止失败/),
    ])
    assert.equal(first.status, 'downloading')
    assert.equal(jobs.running, 1)
    await assert.rejects(jobs.remove('owner', first.id), /仍在运行/)
    assert.ok(fs.existsSync(first.options.outputDir), '停止失败不能清理仍在写入的目录')
    failStop = false
    await jobs.pause('owner', 'one')
    assert.equal(second.status, 'downloading')
    assert.equal(starts.length, 2)
    await jobs.close()
    assert.equal(second.status, 'paused')
    assert.equal(jobs.running, 0)
    assert.equal(fs.existsSync(queuedFile), false, '最后一个排队引用释放后删除淘汰文件')
    assert.throws(() => jobs.submit('owner', raw), /正在停止/)
    await assert.rejects(jobs.parse('owner', firstUrl), /正在停止/)
  } finally {
    failStop = false
    await jobs.close()
    cache.clearParseCache()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
await jobChecks()
async function shutdownChecks(sources = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keep-shutdown-'))
  let finishParse, finishSave, uploadSignal, removed = false
  const load = loader({
    'docker/server/electron-shim.ts': { wsEventBus: new EventEmitter() },
    'docker/server/security.ts': { publicTarget: async () => {} },
    'electron/parsers/ytdlp.ts': { parseWithYtdlp: () => new Promise(resolve => { finishParse = resolve }) },
    'electron/parsers/info-cache.ts': { retainInfoFile: () => () => {}, PARSE_CACHE_LIMIT: 100 },
    'electron/download/ytdlp.ts': {
      runYtdlpDownload: async (_options, outputDir) => ({ filePath: path.join(outputDir, 'test.mp4') }),
      pauseDownload: async () => false,
    },
    'docker/server/storage.ts': { createStorage: () => ({
      save: (_file, _key, signal) => { uploadSignal = signal; return new Promise(resolve => { finishSave = resolve }) },
      remove: async () => { removed = true },
    }) },
  }, { URL, setInterval, clearInterval }, sources)
  const { Jobs } = load('docker/server/jobs.ts')
  const config = { ...load('docker/server/config.ts').readConfig({}), dataDir: dir, workDir: path.join(dir, 'work') }
  const parsing = new Jobs(config, '')
  const uploading = new Jobs({ ...config, dataDir: path.join(dir, 'upload') }, '')
  const tick = () => new Promise(resolve => setImmediate(resolve))
  try {
    const parsed = parsing.parse('owner', 'https://example.com/video')
    await tick()
    let closed = false
    const closedParse = parsing.close().then(() => { closed = true })
    await tick()
    const closedTooEarly = closed
    finishParse({ formats: [] }); await parsed; await closedParse
    assert.equal(closedTooEarly, false, '关闭必须等待解析结束')
    const url = 'https://example.com/video'
    uploading.parsed.set('owner:' + url, { time: Date.now(), info: { formats: [{ formatId: 'mp4' }] } })
    const job = uploading.submit('owner', { taskId: 'upload', url, formatId: 'mp4' })
    await tick()
    const outputDir = job.options.outputDir
    closed = false
    const closedUpload = uploading.close().then(() => { closed = true })
    await tick()
    const state = { closed, aborted: uploadSignal.signal.aborted, exists: fs.existsSync(outputDir) }
    finishSave({ key: 'test', name: 'test.mp4', size: 1, driver: 'r2' }); await closedUpload
    assert.deepEqual(state, { closed: false, aborted: true, exists: true }, '上传收尾之前不能退出或删除文件')
    assert.equal(removed, true, '取消时仍完成的远端对象必须回收')
    assert.equal(fs.existsSync(outputDir), false)
    assert.equal(job.status, 'paused')
  } finally {
    finishParse?.({ formats: [] }); finishSave?.({ key: 'test' })
    await parsing.close(); await uploading.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
await shutdownChecks()
const jobsFile = 'docker/server/jobs.ts', jobsSource = fs.readFileSync(jobsFile, 'utf8')
for (const [before, after] of [
  ['while (this.parsed.size > PARSE_CACHE_LIMIT)', 'while (false)'],
  ['retainInfoFile(job.options.cacheFile)', '(() => {})'],
  ['job.status = previous; throw error', 'job.status = "paused"; throw error'],
]) {
  assert.ok(jobsSource.includes(before))
  await assert.rejects(jobChecks({ [jobsFile]: jobsSource.replace(before, after) }), `Web 变异必须被回归拦住：${before}`)
}
for (const before of [
  'if (this.parsing) await new Promise<void>(resolve => this.parseWaiters.add(resolve))',
  'this.controllers.get(job.id)?.abort()',
]) {
  assert.ok(jobsSource.includes(before))
  await assert.rejects(shutdownChecks({ [jobsFile]: jobsSource.replaceAll(before, 'void 0') }), `关闭变异必须被拦住：${before}`)
}
console.log('通过：Web 解析限额、队列缓存引用、暂停失败保护、解析/上传关闭收尾及 5 个变异反证')
