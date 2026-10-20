import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { loader } from './load-source.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

async function within(promise, milliseconds, message) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds) }),
    ])
  } finally { clearTimeout(timer) }
}

/** 由真实下载入口创建活动项，避免测试手工复制旧的暂停协议。 */
async function pauseCheck(executable, sources = {}) {
  const directory = path.dirname(executable)
  const progress = path.join(directory, 'progress.txt')
  const pidFile = path.join(directory, 'child-pid.txt')
  for (const file of [progress, pidFile]) fs.rmSync(file, { force: true })
  const activeDownloads = new Map()
  const load = loader({
    'electron/store.ts': { activeDownloads },
    'electron/utils/binary.ts': { resolveDependency: async () => executable, getFfmpegLocation: () => '' },
    'electron/parsers/ytdlp.ts': { getExtractorArgs: () => [] },
    'electron/parsers/info-cache.ts': { retainInfoFile: () => () => {} },
    'electron/download/progress.ts': { sendDownloadProgress: () => {}, clearProgressThrottle: () => {} },
    'electron/utils/cookies.ts': {
      getCookieAttempts: () => [],
      runWithCookies: async (_, run) => ({ ...await run([]), failedBrowsers: [] }),
      cookieFailureHint: () => '',
    },
  }, {}, sources)
  const runtime = load('electron/download/ytdlp.ts')
  const taskId = 'pause-native-tree'
  let outcome, child
  const running = runtime.runYtdlpDownload({
    taskId, url: 'https://example.invalid/native-pause', formatId: 'best', acceleration: { enabled: false },
  }, directory).then(result => { outcome = { result }; return outcome }, error => { outcome = { error }; return outcome })
  try {
    const deadline = Date.now() + 10000
    let firstProgress
    while (true) {
      if (outcome?.error) throw outcome.error
      assert.equal(outcome, undefined, '测试程序不应在暂停前结束')
      child = activeDownloads.get(taskId)?.child || child
      if (fs.existsSync(progress)) {
        const current = fs.readFileSync(progress, 'utf8')
        if (firstProgress !== undefined && current !== firstProgress) break
        firstProgress ??= current
      }
      assert.ok(Date.now() < deadline, '子进程未持续写入进度')
      await sleep(50)
    }
    assert.ok(child?.pid, '下载入口必须启动真实原生进程')
    const [paused, finished] = await within(Promise.all([
      runtime.pauseDownload(taskId), running,
    ]), 8000, '暂停未停止进程树')
    assert.equal(paused, true)
    if (finished.error) throw finished.error
    assert.equal(finished.result.paused, true, '下载结果必须确认暂停')
    assert.equal(activeDownloads.size, 0, '收尾后才释放活动任务')
    assert.ok(child.exitCode !== null || child.signalCode !== null, '父进程必须退出')
    const stoppedAt = fs.readFileSync(progress, 'utf8')
    await sleep(500)
    assert.equal(fs.readFileSync(progress, 'utf8'), stoppedAt, '暂停后子进程仍在写入')
  } finally {
    child ||= activeDownloads.get(taskId)?.child
    // 变异或断言失败也清理真实父子进程，不让 exe 文件锁污染后续用例。
    if (process.platform === 'win32') {
      const childPid = fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8').trim() : ''
      for (const pid of [childPid, String(child?.pid || '')].filter(value => /^[1-9]\d*$/.test(value))) {
        spawnSync(path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
          ['/PID', pid, '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 })
      }
    } else if (child?.pid) {
      try { process.kill(-child.pid, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') throw error }
    }
    await within(running, 5000, '原生暂停测试清理未完成')
  }
}

/** 原生进程与生产暂停实现共同回归；变异仅在内存加载器中生效。 */
export async function checkNativePause(executable) {
  await pauseCheck(executable)
  const ytdlp = 'electron/download/ytdlp.ts', tree = 'electron/download/process-tree.ts'
  const mutations = [
    [ytdlp, 'await download.stop()', 'void download'],
    process.platform === 'win32'
      ? [tree, "['/PID', String(pid), '/T', '/F']", "['/PID', String(pid), '/F']"]
      : [tree, 'process.kill(-pid, value)', 'process.kill(pid, value)'],
  ]
  for (const [file, before, after] of mutations) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.ok(source.includes(before), `变异落点必须存在：${file}`)
    await assert.rejects(pauseCheck(executable, { [file]: source.replace(before, after) }),
      /暂停未停止进程树|暂停后子进程仍在写入/, `错误停止实现必须被原生回归拦住：${file}`)
  }
}
