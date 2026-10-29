import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { EventEmitter, once } from 'node:events'
import { createRequire } from 'node:module'
import { loader } from './lib/load-source.mjs'

// 与纯逻辑单测分开：实际网络/文件 IO，Electron IPC 在边界处替换。
const require = createRequire(import.meta.url)
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'downvid-download-'))
const tick = () => new Promise(resolve => setImmediate(resolve))

async function directChecks() {
  const requests = []
  let etag = '"v1"'
  let supportRange = true
  let rateLimits = 0
  let rateLimitedRange = ''
  let retryAfter = '0'
  let onRateLimit = () => {}
  let data = Buffer.alloc(8 * 1024 * 1024 + 1)
  for (let i = 0; i < data.length; i++) data[i] = i % 251
  const server = http.createServer((req, res) => {
    const match = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '')
    const start = supportRange && match ? Number(match[1]) : 0
    const end = supportRange && match ? Number(match[2]) + 1 : data.length
    const request = { range: req.headers.range || 'FULL', start, end, ifRange: req.headers['if-range'] }
    requests.push(request)
    if (rateLimits && req.headers.range !== 'bytes=0-0') {
      rateLimits--
      rateLimitedRange = request.range
      res.writeHead(429, { 'Retry-After': retryAfter }); res.end(); onRateLimit(); return
    }
    res.writeHead(supportRange && match ? 206 : 200, {
      'Content-Length': end - start, ETag: etag,
      ...(supportRange && match ? { 'Content-Range': `bytes ${start}-${end - 1}/${data.length}` } : {}),
    })
    let offset = start
    const timer = setInterval(() => {
      const next = Math.min(end, offset + 16384)
      res.write(data.subarray(offset, next)); offset = next
      if (offset === end) { clearInterval(timer); res.end() }
    }, 1)
    res.on('close', () => clearInterval(timer))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const load = loader({ electron: { BrowserWindow: { getAllWindows: () => [] } } })
  const { downloadDirectFile } = load('electron/download/direct.ts')
  const { createDirectSegments } = load('electron/download/direct-state.ts')
  const url = `http://127.0.0.1:${server.address().port}/video`
  const outputPath = path.join(temp, 'direct.mp4')
  const params = { url, pageUrl: 'https://douyin.com/test', outputPath }
  const pause = async () => {
    const controller = new AbortController()
    await assert.rejects(downloadDirectFile({ ...params, signal: controller.signal,
      report: value => { if (value.percent > 1) controller.abort() },
    }), error => error.name === 'AbortError')
    assert.ok(fs.existsSync(`${outputPath}.part`))
  }
  const complete = async () => {
    await downloadDirectFile({ ...params, signal: new AbortController().signal, report: () => {} })
    assert.deepEqual(fs.readFileSync(outputPath), data)
    assert.equal(fs.existsSync(`${outputPath}.part`), false)
    assert.equal(fs.existsSync(`${outputPath}.part.json`), false)
  }
  const assertFreshSegments = () => {
    const actual = requests.filter(item => item.range !== 'bytes=0-0')
      .map(item => ({ start: item.start, end: item.end }))
      .sort((a, b) => a.start - b.start)
    const expected = Array.from(createDirectSegments(data.length), ({ start, end }) => ({ start, end }))
    assert.deepEqual(actual, expected)
  }
  try {
    await pause()
    const saved = JSON.parse(fs.readFileSync(`${outputPath}.part.json`, 'utf8'))
    assert.ok(saved.segments.some(segment => segment.offset > segment.start))
    requests.length = 0
    await complete()
    const resumed = requests.filter(item => item.range !== 'bytes=0-0')
    // 断言「每个未完成分段都被续传」，而**不是**「请求序列与检查点逐项相等」。
    //
    // 后者是脆的：429/503 或瞬时网络错误都会让某个分段重试，
    // 重试会再发一次相同 Range，于是请求数比检查点多一项。
    // 这个用例曾因此在 CI 上偶发失败（同一提交重跑就过）——
    // 偶发红叉会训练人忽略 CI，比没有检查更糟。
    const expectedOffsets = [...new Set(
      saved.segments.filter(segment => segment.offset < segment.end).map(segment => segment.offset),
    )].sort((a, b) => a - b)
    const actualOffsets = [...new Set(resumed.map(item => item.start))].sort((a, b) => a - b)
    assert.deepEqual(actualOffsets, expectedOffsets)
    // 允许多余的请求，但它们必须只是「同一分段的重复续传」，不能是别的位置
    assert.ok(resumed.every(item => expectedOffsets.includes(item.start)),
      `出现了预期之外的续传位置：${resumed.map(i => i.start).filter(s => !expectedOffsets.includes(s))}`)
    assert.ok(resumed.length >= expectedOffsets.length, '每个未完成分段都应至少被续传一次')
    assert.ok(resumed.every(item => item.ifRange === '"v1"'))
    console.log('通过：多段暂停保留进度、Range 续传、文件逐字节校验与临时文件清理')

    await pause()
    etag = '"v2"'
    requests.length = 0
    await complete()
    assertFreshSegments()
    assert.ok(requests.filter(item => item.range !== 'bytes=0-0').every(item => item.ifRange === etag))
    console.log('通过：同 URL 的资源版本变化后从头下载')

    await pause()
    fs.writeFileSync(`${outputPath}.part.json`, '{broken')
    requests.length = 0
    await complete()
    assertFreshSegments()
    console.log('通过：损坏检查点不续传')

    rateLimits = 1
    requests.length = 0
    await complete()
    assert.equal(rateLimits, 0)
    assert.ok(rateLimitedRange && requests.filter(item => item.range === rateLimitedRange).length >= 2)
    console.log('通过：429 降低并发并重试，最终文件保持完整')

    rateLimits = 1; retryAfter = '30'
    const backoff = new AbortController()
    onRateLimit = () => setTimeout(() => backoff.abort(), 50)
    const pauseStart = Date.now()
    await assert.rejects(downloadDirectFile({ ...params, signal: backoff.signal, report: () => {} }), error => error.name === 'AbortError')
    assert.ok(Date.now() - pauseStart < 2000, '重试等待期间暂停必须及时生效')
    retryAfter = '0'; onRateLimit = () => {}
    await complete()
    console.log('通过：长 Retry-After 等待期间可立即暂停并继续')

    supportRange = false
    await pause()
    assert.equal(fs.existsSync(`${outputPath}.part.json`), false)
    requests.length = 0
    await complete()
    assert.equal(requests[1].range, 'FULL')
    console.log('通过：无 Range 支持时安全重下，不拼接旧数据')

    data = data.subarray(0, 1024 * 1024)
    supportRange = true
    await pause()
    const small = JSON.parse(fs.readFileSync(`${outputPath}.part.json`, 'utf8'))
    assert.equal(small.segments.length, 1)
    requests.length = 0
    await complete()
    assert.equal(requests[1].start, small.segments[0].offset)
    console.log('通过：小文件单段 Range 续传')
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}

async function storeChecks(sources = {}) {
  const pinia = require('pinia')
  pinia.setActivePinia(pinia.createPinia())
  let saved = '{}'
  const storage = { getItem: () => saved, setItem: (_key, value) => { saved = value } }
  const pending = [], calls = [], cleanups = [], listeners = [], history = []
  const api = {
    ytdlp: { download: options => { calls.push(options); return new Promise(resolve => pending.push(resolve)) }, pauseDownload: async () => true },
    history: { add: async entry => history.push(entry) },
    onDownloadProgress: callback => {
      const id = listeners.push(callback)
      return () => cleanups.push(id)
    },
  }
  const load = loader({
    'src/stores/deps.ts': { useDepsStore: () => ({ deps: [], promptForMissing: () => {} }), readMissingKinds: () => [], stripDepMarkers: x => x },
  }, { window: { electronAPI: api }, localStorage: storage }, sources)
  const { useDownloadStore } = load('src/stores/download.ts')
  const { updateSettings } = load('src/stores/settings.ts')
  const store = useDownloadStore()
  store.url = 'https://douyin.com/test'
  store.videoInfo = { title: '测试视频', thumbnail: '' }
  store.selectedFormat = { formatId: 'test', quality: '720p', ext: 'mp4', url: 'https://cdn.example/video' }
  store.downloadDir = temp
  await store.startDownload()
  const task = store.downloadTasks[0]
  const newDir = path.join(temp, 'new-directory')
  const originalTemplate = calls[0].filenameTemplate
  assert.ok(originalTemplate.includes('%(format_id)s'), '新视频任务必须区分格式')
  updateSettings({ downloadDir: newDir, filenameTemplate: 'changed.%(ext)s' })
  store.pauseTask(task.id)
  const resume = store.resumeTask(task)
  const duplicateResume = store.resumeTask(task)
  await tick()
  assert.equal(pending.length, 1, '旧下载未收尾之前不能复用 taskId')
  pending[0]({ paused: true })
  await Promise.all([resume, duplicateResume])
  assert.equal(pending.length, 2)
  assert.equal(task.status, 'downloading')
  assert.deepEqual(cleanups, [1])
  assert.equal(calls[1].outputDir, temp, '续传保持原目录')
  assert.equal(calls[1].filenameTemplate, originalTemplate, '续传不跟随模板设置变化')
  listeners[1]({ taskId: task.id, percent: 50, status: 'downloading' })
  assert.equal(task.progress, 50)
  assert.equal(history.length, 0)
  pending[1]({ filePath: path.join(temp, 'video.mp4') })
  await tick()
  assert.equal(task.status, 'completed')
  assert.equal(history.length, 1)
  assert.deepEqual(cleanups, [1, 2])
  await new Promise(resolve => setTimeout(resolve, 2))
  await store.startDownload()
  assert.equal(calls[2].outputDir, newDir, '新任务立即使用保存的目录')
  pending[2]({ paused: true })
  await tick()
  const oldTask = store.downloadTasks[0]
  delete oldTask.filenameTemplate
  await store.resumeTask(oldTask)
  assert.equal(calls[3].filenameTemplate, 'changed.%(ext)s', '旧任务不补后缀，以免丢失旧片段')
  api.ytdlp.pauseDownload = async () => { throw new Error('模拟停止失败') }
  store.pauseTask(oldTask.id)
  await store.resumeTask(oldTask)
  assert.equal(oldTask.status, 'downloading', '暂停失败保留运行状态和槽位')
  assert.ok(oldTask.error, '暂停失败必须向用户显示')
  store.removeTask(oldTask.id)
  assert.ok(store.downloadTasks.includes(oldTask), '旧进程未结束不能删除后重建任务')
  assert.equal(calls.length, 4)
  api.ytdlp.pauseDownload = async () => true
  store.pauseTask(oldTask.id)
  pending[3]({ paused: true })
  await tick()
  console.log('通过：旧下载收尾后恢复、重复继续防重入、进度监听、历史仅完成写入、目录立即生效')
}

async function ipcChecks() {
  const activeDownloads = new Map()
  const handlers = new Map()
  let rejectDownload
  const direct = { downloadDirectFile: () => new Promise((_resolve, reject) => { rejectDownload = reject }) }
  const load = loader({
    electron: { ipcMain: { handle: (name, callback) => handlers.set(name, callback) }, BrowserWindow: { getAllWindows: () => [] } },
    'electron/store.ts': { activeDownloads },
    'electron/download/direct.ts': direct,
    'electron/utils/binary.ts': {}, 'electron/utils/cookies.ts': {},
    'electron/parsers/ytdlp.ts': {}, 'electron/parsers/douyin.ts': {}, 'electron/parsers/kuaishou.ts': {},
  })
  load('electron/ipc/download.ts').registerDownloadIpc()
  const download = handlers.get('ytdlp:download')(null, {
    taskId: 'ipc', url: 'https://douyin.com/test', directUrl: 'https://cdn.example/video', outputDir: temp,
  })
  let stopped = false
  const pause = handlers.get('ytdlp:pauseDownload')(null, 'ipc').then(() => { stopped = true })
  await tick()
  assert.equal(stopped, false, 'abort 不能提前确认暂停')
  assert.ok(activeDownloads.has('ipc'))
  rejectDownload(new Error('已暂停'))
  await pause
  assert.equal((await download).paused, true)
  assert.equal(activeDownloads.has('ipc'), false)
  console.log('通过：直链暂停 IPC 等待文件下载完整收尾')
}

async function preparingChecks() {
  let resolveDependency
  const activeDownloads = new Map()
  const load = loader({
    electron: { BrowserWindow: { getAllWindows: () => [] } },
    'electron/store.ts': { activeDownloads },
    'electron/utils/binary.ts': { resolveDependency: () => new Promise(resolve => { resolveDependency = resolve }) },
    'electron/utils/cookies.ts': {}, 'electron/parsers/ytdlp.ts': {},
  })
  const runtime = load('electron/download/ytdlp.ts')
  const running = runtime.runYtdlpDownload({ taskId: 'preparing', url: 'https://example.com/video' }, temp)
  const paused = runtime.pauseDownload('preparing')
  resolveDependency('not-executed')
  assert.equal(await paused, true)
  assert.equal((await running).paused, true)
  assert.equal(activeDownloads.size, 0)
  console.log('通过：探测/准备期间暂停不会事后启动下载进程')
}

async function subtitleChecks(sources = {}) {
  const dir = fs.mkdtempSync(path.join(temp, 'subtitles-'))
  const contents = '1\n00:00:00,000 --> 00:00:01,000\n字幕测试\n\n'
  const files = { en: path.join(dir, '字幕测试.en.srt'), 'zh-Hans': path.join(dir, '字幕测试.zh-Hans.srt') }
  const activeDownloads = new Map()
  const load = loader({
    'electron/store.ts': { activeDownloads },
    'electron/utils/binary.ts': { resolveDependency: async () => 'fixture-tool', getFfmpegLocation: () => '' },
    'electron/parsers/ytdlp.ts': { getExtractorArgs: () => [] },
    'electron/parsers/info-cache.ts': { retainInfoFile: () => () => {} },
    'electron/download/progress.ts': { sendDownloadProgress: () => {}, clearProgressThrottle: () => {} },
    'electron/utils/cookies.ts': { getCookieAttempts: () => [], runWithCookies: async (_attempts, run) => ({ ...await run([]), failedBrowsers: [] }) },
    'electron/download/process-tree.ts': { treeSpawnOptions: () => ({}) },
    'node:child_process': { spawn: (_file, args) => {
      const child = new EventEmitter()
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter()
      queueMicrotask(() => {
        for (const file of Object.values(files)) fs.writeFileSync(file, contents)
        // --skip-download 会生成字幕，但不执行 after_move；after_video 才有转换后的路径。
        const output = args[args.indexOf('--print') + 1]
        if (output.startsWith('after_video:')) {
          const line = '[dvsubs]' + JSON.stringify({
            unavailable: { ext: 'vtt' },
            en: { ext: 'srt', filepath: files.en },
            'zh-Hans': { ext: 'srt', filepath: files['zh-Hans'] },
          })
          child.stdout.emit('data', Buffer.from(line.slice(0, 12)))
          child.stdout.emit('data', Buffer.from(line.slice(12)))
        }
        child.emit('close', 0)
      })
      return child
    } },
  }, {}, sources)
  const runtime = load('electron/download/ytdlp.ts')
  try {
    for (const [subtitles, expected] of [[['zh-Hans', 'en'], files['zh-Hans']], [['en'], files.en], [[], files.en]]) {
      const result = await runtime.runYtdlpDownload({ taskId: 'subtitle', url: 'https://example.com/video', formatId: 'subtitle',
        downloadMode: 'subtitle', subtitles, acceleration: { enabled: false }, outputDir: dir }, dir)
      assert.equal(result.code, 0)
      assert.equal(result.filePath, expected, '纯字幕成功时必须返回所选语言转换后的实际文件，不能只生成文件却回传空路径')
      assert.equal(fs.readFileSync(result.filePath, 'utf8'), contents)
      assert.equal(activeDownloads.size, 0)
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

async function subtitleRegressionChecks() {
  await subtitleChecks()
  const file = 'electron/download/ytdlp.ts'
  const source = fs.readFileSync(file, 'utf8')
  const before = 'after_video:${SUBS_PREFIX}'
  assert.ok(source.includes(before), '字幕输出阶段的变异落点必须存在')
  await assert.rejects(subtitleChecks({ [file]: source.replace(before, 'after_move:${SUBS_PREFIX}') }), '恢复错误的字幕输出阶段必须被回归用例拦住')
  console.log('通过：纯字幕成品路径、带连字符语言、分块输出收尾及输出阶段变异反证')
}

async function treeChecks(sources = {}) {
  let now = 0, alive = true
  const signals = []
  const load = loader({}, {
    process: { kill: (pid, signal) => {
      assert.equal(pid, -45678, '必须给进程组发信号，不是只给父进程')
      signals.push(signal)
      if (!alive) throw Object.assign(new Error('gone'), { code: 'ESRCH' })
      if (signal === 'SIGKILL') alive = false
    } },
    Date: { now: () => now },
    setTimeout: (callback, milliseconds) => { now += milliseconds; queueMicrotask(callback) },
  }, sources)
  const tree = load('electron/download/process-tree.ts')
  // 父进程早已退出，孙进程仍然忽略 TERM。
  await tree.killProcessTree({ pid: 45678, exitCode: 0, signalCode: null }, 'linux')
  assert.ok(signals.includes('SIGKILL'))
  assert.equal(alive, false)
  assert.ok(tree.treeSpawnOptions('linux').detached)
  assert.equal(tree.treeSpawnOptions('win32').detached, false)
}

async function treeBoundaryChecks() {
  let callback, calls = 0, settled = false
  const tree = loader({ 'node:child_process': { execFile: (file, args, options, done) => {
    assert.equal(file, path.win32.join('C:\\Windows', 'System32', 'taskkill.exe'))
    assert.equal(Array.from(args).join(' '), '/PID 45678 /T /F')
    assert.equal(options.timeout, 5000)
    calls++; callback = done
  } } }, { process: { env: {} } })('electron/download/process-tree.ts')
  const child = { pid: 45678, exitCode: 0, signalCode: null }
  const pending = tree.killProcessTree(child, 'win32').then(() => { settled = true })
  await tick(); assert.equal(settled, false)
  callback(null); await pending; assert.equal(calls, 1)
  const failure = tree.killProcessTree(child, 'win32')
  const rejected = assert.rejects(failure, /无法停止/)
  callback(new Error('taskkill failed')); await rejected
  const denied = loader({}, { process: { kill: () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }) } } })('electron/download/process-tree.ts')
  await assert.rejects(denied.killProcessTree(child, 'linux'), /denied/)
  let now = 0
  const stuck = loader({}, { process: { kill: () => {} }, Date: { now: () => now }, setTimeout: (done, ms) => { now += ms; queueMicrotask(done) } })('electron/download/process-tree.ts')
  await assert.rejects(stuck.killProcessTree(child, 'linux'), /无法停止/)
  assert.ok(now <= 3500, '停止失败必须有预算上限')
}

async function realTreeCheck() {
  const descendant = `process.on('SIGTERM', () => {}); console.log('ready:' + process.pid); setInterval(() => {}, 1000)`
  const parent = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: ['ignore', 'inherit', 'inherit'] }); setInterval(() => {}, 1000)`
  const tree = loader()('electron/download/process-tree.ts')
  const child = spawn(process.execPath, ['-e', parent], { ...tree.treeSpawnOptions(), stdio: ['ignore', 'pipe', 'pipe'] })
  const closed = once(child, 'close')
  let output = ''
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('进程树测试启动超时')), 10000)
      child.stdout.on('data', data => { output += data; if (/ready:\d+/.test(output)) { clearTimeout(timer); resolve() } })
      child.once('error', error => { clearTimeout(timer); reject(error) })
    })
    await tree.killProcessTree(child)
    await closed
    const pid = Number(/ready:(\d+)/.exec(output)[1])
    assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH', '孙进程必须真正停止')
  } finally {
    if (process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGKILL') } catch {} }
    else if (child.exitCode === null && child.signalCode === null) await tree.killProcessTree(child).catch(() => {})
  }
}

async function stopFailureCheck(sources = {}) {
  const child = new EventEmitter()
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.pid = 45678
  const activeDownloads = new Map()
  let stops = 0, done = false
  const load = loader({
    'electron/store.ts': { activeDownloads },
    'electron/utils/binary.ts': { resolveDependency: async () => 'tool', getFfmpegLocation: () => '' },
    'electron/parsers/ytdlp.ts': { getExtractorArgs: () => [] },
    'electron/parsers/info-cache.ts': { retainInfoFile: () => () => {} },
    'electron/download/progress.ts': { sendDownloadProgress: () => {}, clearProgressThrottle: () => {} },
    'electron/utils/cookies.ts': { getCookieAttempts: () => [], runWithCookies: async (_attempts, run) => ({ ...await run([]), failedBrowsers: [] }) },
    'node:child_process': { spawn: () => child },
    'electron/download/process-tree.ts': { treeSpawnOptions: () => ({}), killProcessTree: async () => {
      stops++
      if (stops === 1) throw new Error('模拟整树停止失败')
      child.emit('close', 0)
    } },
  }, {}, sources)
  const runtime = load('electron/download/ytdlp.ts')
  const options = { taskId: 'stopping', url: 'https://example.com/video', formatId: 'best', acceleration: { enabled: false } }
  const running = runtime.runYtdlpDownload(options, temp).then(value => { done = true; return value })
  await tick()
  await assert.rejects(runtime.pauseDownload(options.taskId), /模拟整树停止失败/)
  child.emit('close', 0)
  await tick()
  assert.equal(done, false, '整树未停止，即使父进程 close 也不能结束下载调用')
  assert.ok(activeDownloads.has(options.taskId))
  await assert.rejects(runtime.runYtdlpDownload(options, temp), /尚未停止/)
  await runtime.pauseDownload(options.taskId)
  assert.equal((await running).paused, true)
  assert.equal(stops, 2)
  assert.equal(activeDownloads.size, 0)
  const stoppingAll = runtime.stopAllDownloads()
  assert.throws(() => runtime.assertDownloadCanStart('next'), /尚未停止/)
  const resume = await stoppingAll
  assert.throws(() => runtime.assertDownloadCanStart('next'), /尚未停止/, '安装前仍需封住启动入口')
  resume(); resume()
  runtime.assertDownloadCanStart('next')
}

function atomicHistoryChecks(sources = {}) {
  const dir = fs.mkdtempSync(path.join(temp, 'history-'))
  const file = path.join(dir, 'download-history.json')
  const atomic = loader({}, {}, sources)('electron/utils/atomic-file.ts').writeFileAtomic
  atomic(file, 'old')
  for (const method of ['writeFileSync', 'fsyncSync', 'renameSync']) {
    const faulty = loader({ 'node:fs': { ...fs, [method]: () => { throw new Error('模拟故障-' + method) } } }, {}, sources)('electron/utils/atomic-file.ts').writeFileAtomic
    assert.throws(() => faulty(file, 'new'), /模拟故障/)
    assert.equal(fs.readFileSync(file, 'utf8'), 'old', `${method} 失败不能丢失原文件`)
    assert.deepEqual(fs.readdirSync(dir), ['download-history.json'])
  }
  atomic(file, 'new'); assert.equal(fs.readFileSync(file, 'utf8'), 'new')
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600)
  const failedCleanup = loader({ 'node:fs': { ...fs, rmSync: () => { throw new Error('清理失败') } } }, {}, sources)('electron/utils/atomic-file.ts').writeFileAtomic
  failedCleanup(file, 'saved'); assert.equal(fs.readFileSync(file, 'utf8'), 'saved')
  return { dir, file }
}

async function historyChecks(sources = {}) {
  const { dir, file } = atomicHistoryChecks(sources)
  const handlers = new Map()
  const mocks = { electron: { app: { getPath: () => dir }, ipcMain: { handle: (name, callback) => handlers.set(name, callback) }, BrowserWindow: { getAllWindows: () => [] } } }
  loader(mocks, {}, sources)('electron/ipc/history.ts').registerHistoryIpc()
  fs.writeFileSync(file, '{broken')
  assert.equal((await handlers.get('history:get')()).length, 0)
  const backup = fs.readdirSync(dir).find(name => name.includes('.corrupt-'))
  assert.ok(backup, '损坏历史必须独立备份')
  assert.equal(fs.readFileSync(path.join(dir, backup), 'utf8'), '{broken')
  assert.equal(fs.readFileSync(file, 'utf8'), '[]')
  fs.writeFileSync(file, '{unrecoverable')
  for (const method of ['copyFileSync', 'readFileSync']) {
    loader({ ...mocks, 'node:fs': { ...fs, [method]: () => { throw Object.assign(new Error('拒绝读取或备份'), { code: 'EACCES' }) } } }, {}, sources)('electron/ipc/history.ts').registerHistoryIpc()
    await assert.rejects(handlers.get('history:delete')(null, 'any'), /拒绝读取或备份/)
    assert.equal(fs.readFileSync(file, 'utf8'), '{unrecoverable', '无读取或备份权限时不能覆盖为空')
  }
}

async function reliabilityChecks() {
  await treeChecks(); await treeBoundaryChecks(); await realTreeCheck(); await stopFailureCheck(); await historyChecks()
  const mutations = [
    ['electron/download/process-tree.ts', 'process.kill(-pid, value)', 'process.kill(pid, value)', treeChecks],
    ['electron/download/process-tree.ts', "if (await waitGone(1500)) return", 'return', treeChecks],
    ['electron/download/ytdlp.ts', 'closed && (!isPaused || stopConfirmed)', 'closed', stopFailureCheck],
    ['electron/download/ytdlp.ts', 'closing++', 'void closing', stopFailureCheck],
    ['src/stores/download.ts', 'task.filenameTemplate ??= settings.filenameTemplate', 'settings.filenameTemplate', storeChecks],
    ['src/stores/download.ts', 'if (taskExecutions.has(taskId)) return', 'void taskId', storeChecks],
    ['electron/utils/atomic-file.ts', 'fs.fsyncSync(descriptor)', 'void descriptor', historyChecks],
    ['electron/ipc/history.ts', 'fs.copyFileSync(historyFile, `${historyFile}.corrupt-${randomUUID()}.bak`, fs.constants.COPYFILE_EXCL)', 'void historyFile', historyChecks],
  ]
  for (const [file, before, after, check] of mutations) {
    const source = fs.readFileSync(file, 'utf8')
    assert.ok(source.includes(before), '变异落点必须存在')
    await assert.rejects(check({ [file]: source.replace(before, after) }), `变异必须被用例拦住：${file}`)
  }
  console.log('通过：真实父/孙进程停止、Windows taskkill 边界、停止失败不续传、历史原子写入/损坏备份及 8 个变异反证')
}

try {
  await directChecks()
  await storeChecks()
  await ipcChecks()
  await preparingChecks()
  await subtitleRegressionChecks()
  await reliabilityChecks()
  await import('./test-parse-integration.mjs')
} finally { fs.rmSync(temp, { recursive: true, force: true }) }
