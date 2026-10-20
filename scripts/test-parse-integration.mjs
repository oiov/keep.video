import assert from 'node:assert/strict'
import fs from 'node:fs'
import { EventEmitter } from 'node:events'
import { loader } from './lib/load-source.mjs'

// 子进程和 Cookie 位于边界；回退、格式生成及诊断使用生产源码。
async function scenario(errors, version = '2026.10.10.233141', available = true, snapshot = 'matching', sources = {}) {
  const calls = []
  let cleaned = false
  let resolved = false
  const load = loader({
    'electron/utils/binary.ts': { resolveDependency: async () => { resolved = true; return 'fixture-tool' }, checkJsRuntime: async () => ({ available, kind: 'node', path: 'fixture-node', version: '22.0.0' }) },
    'electron/utils/runtime.ts': { cachedStatusSnapshot: () => {
      assert.ok(resolved, '冷启动必须先探测再读取版本')
      return snapshot === 'missing' ? null : { results: [{ kind: 'yt-dlp', found: snapshot !== 'unavailable', path: snapshot === 'mismatch' ? 'other-tool' : 'fixture-tool', version }] }
    } },
    'electron/utils/browser.ts': { getInstalledBrowsers: () => [] },
    'electron/utils/cookies.ts': {
      getCookieAttempts: () => [], isCookieError: () => false, cookieFailureHint: () => '',
      runWithCookies: async (_attempts, run) => {
        try { return { ...await run(['--cookies', 'fixture-cookie']), failedBrowsers: [] } }
        finally { cleaned = true }
      },
    },
    'electron/constants.ts': { LANG_NAMES: {} },
    electron: { dialog: {}, shell: {} },
    'node:child_process': { spawn: (_file, args) => {
      assert.ok(!args.includes('--version'), '解析不应额外启动版本子进程')
      const child = new EventEmitter()
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter()
      queueMicrotask(() => {
        assert.equal(cleaned, false, '回退不能使用已清理的 Cookie 临时文件')
        calls.push(args)
        const error = errors.shift()
        if (error) child.stderr.emit('data', Buffer.from(error))
        else child.stdout.emit('data', Buffer.from(JSON.stringify({ id: 'fixture', formats: [{ format_id: 'hls', protocol: 'm3u8_native', height: 720, vcodec: 'h264', acodec: 'aac' }] })))
        child.emit('close', error ? 1 : 0)
      })
      return child
    } },
  }, { process: Object.assign(Object.create(process), { once: () => {} }) }, sources)
  const parser = load('electron/parsers/ytdlp.ts')
  let result, error
  try { result = await parser.parseWithYtdlp('https://www.youtube.com/watch?v=fixture') }
  catch (value) { error = value.message }
  const extractorArgs = parser.getExtractorArgs('https://www.youtube.com/watch?v=fixture')
  load('electron/parsers/info-cache.ts').clearParseCache()
  return { calls, result, error, extractorArgs, cleaned }
}

const format = await scenario(['ERROR: Requested format is not available'])
assert.equal(format.calls.length, 2)
assert.equal(format.result.formats[0].formatId, 'hls')
assert.ok(format.result.parseNotice)
assert.ok(!format.calls[1].includes('--extractor-args'))
assert.ok(format.calls.every(args => args[args.indexOf('--cookies') + 1] === 'fixture-cookie'))
assert.ok(format.calls.every(args => !args.includes('--no-warnings')))
assert.ok(format.calls.every(args => args.includes('--ignore-config')))
assert.equal(format.cleaned, true)

for (const [version, client] of [['2026.09.01', 'web_safari'], ['2026.10.10.233141', 'default,web_embedded']]) {
  const page = await scenario(['ERROR: The page needs to be reloaded'], version)
  assert.equal(page.calls.length, 2)
  assert.ok(page.calls[1].some(arg => arg.includes(`player_client=${client}`)))
  assert.ok(page.extractorArgs.some(arg => arg.includes(client)))
  assert.ok(page.result.parseNotice.includes('Cookie'))
}

const exhausted = await scenario(['The page needs to be reloaded', 'Requested format is not available', 'The page needs to be reloaded https://example.invalid/?token=fixture-secret'])
assert.equal(exhausted.calls.length, 3)
assert.ok(exhausted.error.includes('page-reload'))
assert.ok(!exhausted.error.includes('fixture-secret'))
assert.ok(exhausted.error.includes('2026.10.10.233141'))
const network = await scenario(['Connection timed out'])
assert.equal(network.calls.length, 1)
assert.ok(network.error.includes('network'))
const missing = await scenario([], undefined, false)
assert.equal(missing.calls.length, 0)
assert.ok(missing.error.includes('runtime-unavailable'))
for (const snapshot of ['missing', 'mismatch', 'unavailable']) {
  const page = await scenario(['The page needs to be reloaded'], undefined, true, snapshot)
  assert.ok(page.calls[1].some(arg => arg.includes('player_client=web_safari')))
}

function cacheChecks(sources = {}) {
  let now = Date.now(), onExit
  const load = loader({}, {
    Date: class extends Date { static now() { return now } },
    process: Object.assign(Object.create(process), { once: (event, callback) => { assert.equal(event, 'exit'); onExit = callback } }),
  }, sources)
  const cache = load('electron/parsers/info-cache.ts')
  const add = (key, args = []) => {
    const data = { title: key }
    cache.cacheParsedInfo(key, 'https://example.com/video', data, JSON.stringify({ id: 'same-id' }), args)
    return data
  }
  try {
    const first = add('first', ['first-client'])
    const second = add('second', ['second-client'])
    assert.ok(first.cacheFile && second.cacheFile, '每次解析都生成独立缓存文件')
    assert.notEqual(first.cacheFile, second.cacheFile, '相同视频也必须隔离文件')
    if (process.platform !== 'win32') assert.equal(fs.statSync(first.cacheFile).mode & 0o777, 0o600)
    assert.equal(cache.getExtractorArgs('https://example.com/video', first.cacheFile)[0], 'first-client')
    const release = cache.retainInfoFile(first.cacheFile)
    for (let i = 0; i < cache.PARSE_CACHE_LIMIT - 2; i++) add('key-' + i)
    assert.ok(cache.getCachedParse('second'), '命中刷新 LRU 顺序')
    add('overflow')
    assert.equal(cache.getCachedParse('first'), undefined, '超过上限淘汰最旧项')
    assert.ok(cache.getCachedParse('second'))
    assert.ok(fs.existsSync(first.cacheFile), '正在下载的 JSON 不能被淘汰删除')
    assert.equal(cache.getExtractorArgs('https://example.com/video', first.cacheFile)[0], 'first-client')
    release(); release()
    assert.equal(fs.existsSync(first.cacheFile), false, '最后一个引用释放后删除')
    now += cache.PARSE_CACHE_TTL
    assert.equal(cache.getCachedParse('second'), undefined)
    assert.equal(fs.existsSync(second.cacheFile), false)
    const last = add('exit')
    onExit()
    assert.equal(fs.existsSync(last.cacheFile), false, '退出清理临时 JSON')
  } finally { cache.clearParseCache() }
}
cacheChecks()
const cacheFile = 'electron/parsers/info-cache.ts'
const cacheSource = fs.readFileSync(cacheFile, 'utf8')
for (const [before, after] of [
  ['while (entries.size > PARSE_CACHE_LIMIT)', 'while (false)'],
  ['|| state.readers', ''],
  ['>= PARSE_CACHE_TTL', '> PARSE_CACHE_TTL'],
  ['randomUUID() +', '"same-id" +'],
]) {
  assert.ok(cacheSource.includes(before))
  assert.throws(() => cacheChecks({ [cacheFile]: cacheSource.replace(before, after) }), `缓存变异必须被回归拦住：${before}`)
}
const parserFile = 'electron/parsers/ytdlp.ts'
const parserSource = fs.readFileSync(parserFile, 'utf8')
const mutatedVersion = await scenario(['The page needs to be reloaded'], undefined, true, 'matching', {
  [parserFile]: parserSource.replace('const version = cachedStatusSnapshot()', 'const version = "" && cachedStatusSnapshot()'),
})
assert.ok(!mutatedVersion.calls[1].some(arg => arg.includes('player_client=default,web_embedded')), '空版本变异应失去新客户端回退')
console.log('通过：格式/版本兼容回退、三轮上限、Cookie 生命周期、脱敏诊断与运行时缺失引导')
console.log('通过：缓存限额、LRU、TTL、私有文件、下载引用、退出清理与 5 个变异反证')
