import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { parseWithYtdlp } from '../../electron/parsers/ytdlp'
import { runYtdlpDownload, pauseDownload } from '../../electron/download/ytdlp'
import { wsEventBus } from './electron-shim'
import { publicTarget } from './security'
import { createStorage, type StoredFile } from './storage'
import type { Config } from './config'

export interface Job {
  id: string; owner: string; clientId: string; url: string; title: string; createdAt: number
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused'
  progress: number; file?: StoredFile; localPath?: string; error?: string; options?: any
}

export class Jobs extends EventEmitter {
  jobs = new Map<string, Job>()
  parsed = new Map<string, { time: number; info: any }>()
  running = 0
  parsing = 0
  storage: ReturnType<typeof createStorage>
  constructor(public config: Config, public proxy: string) {
    super()
    this.setMaxListeners(100)
    this.storage = createStorage(config)
    fs.mkdirSync(config.dataDir, { recursive: true })
    fs.mkdirSync(config.workDir, { recursive: true })
    try {
      for (const job of JSON.parse(fs.readFileSync(this.manifest(), 'utf8'))) {
        if (job.file && job.file.driver !== config.storage) throw new Error('请先清理旧存储任务再切换存储驱动')
        if (job.status === 'pending' || job.status === 'downloading') { job.status = 'error'; job.error = '服务已重启，请重新解析下载' }
        this.jobs.set(job.id, job)
      }
    } catch (error) { if (fs.existsSync(this.manifest())) throw error }
    wsEventBus.on('download:progress', data => {
      const job = this.jobs.get(data.taskId)
      if (!job || job.status !== 'downloading') return
      job.progress = Math.min(98, data.percent || 0)
      this.emit('progress', job.owner, { ...data, taskId: job.clientId, status: data.status === 'completed' ? 'merging' : data.status, percent: job.progress })
    })
  }
  manifest() { return path.join(this.config.dataDir, 'web-jobs.json') }
  persist() {
    const file = this.manifest()
    fs.writeFileSync(file + '.part', JSON.stringify([...this.jobs.values()].map(({ options, ...job }) => job)))
    fs.renameSync(file + '.part', file)
  }
  view(job: Job) {
    return { id: job.id, clientId: job.clientId, title: job.title, url: job.url, status: job.status, progress: job.progress, error: job.error, createdAt: new Date(job.createdAt).toISOString(), filePath: job.file ? '/api/files/' + job.id : undefined, fileExists: !!job.file, quality: job.file?.name || '', format: job.file ? path.extname(job.file.name).slice(1) : '' }
  }
  list(owner: string) { return [...this.jobs.values()].filter(j => j.owner === owner).map(j => this.view(j)).reverse() }
  async parse(owner: string, raw: unknown) {
    if (typeof raw !== 'string' || raw.length > 4096) throw new Error('链接无效')
    if (this.parsing >= this.config.concurrency) throw new Error('解析繁忙，请稍后重试')
    this.parsing++
    try {
      await publicTarget(raw)
      const info = await parseWithYtdlp(raw, '', this.proxy)
      this.parsed.set(owner + ':' + raw, { time: Date.now(), info })
      const { cacheFile, ...publicInfo } = info
      return publicInfo
    } finally { this.parsing-- }
  }
  submit(owner: string, raw: any) {
    const parsed = this.parsed.get(owner + ':' + raw?.url)
    if (!parsed || Date.now() - parsed.time > 20 * 60000) throw new Error('请先重新解析链接')
    const existing = [...this.jobs.values()].find(j => j.owner === owner && j.clientId === raw.taskId && j.status !== 'error' && j.status !== 'paused')
    if (existing) return existing
    if ([...this.jobs.values()].filter(j => ['pending', 'downloading'].includes(j.status)).length >= this.config.maxQueued || [...this.jobs.values()].filter(j => j.owner === owner).length >= this.config.maxSessionTasks) throw new Error('任务数量达到上限，请删除旧任务后重试')
    if (typeof raw.taskId !== 'string' || raw.taskId.length > 120) throw new Error('任务标识无效')
    const mode = ['video', 'audio', 'subtitle'].includes(raw.downloadMode) ? raw.downloadMode : 'video'
    const formats = [...parsed.info.formats, ...(parsed.info.audioFormats || [])]
    const format = formats.find((f: any) => f.formatId === raw.formatId)
    if (!format && mode !== 'subtitle') throw new Error('请选择解析结果中的格式')
    const id = randomUUID()
    const job: Job = { id, owner, clientId: raw.taskId, url: raw.url, title: parsed.info.title, createdAt: Date.now(), status: 'pending', progress: 0 }
    job.options = { url: job.url, taskId: id, outputDir: path.join(this.config.workDir, id), formatId: format?.formatId || 'best', hasAudio: format?.hasAudio, downloadMode: mode, filenameTemplate: '%(title).120B.%(ext)s', proxy: this.proxy, cookiesFile: '', cacheFile: parsed.info.cacheFile, acceleration: { enabled: false }, subtitles: (parsed.info.subtitles || []).filter((s: any) => Array.isArray(raw.subtitles) && raw.subtitles.includes(s.language)).map((s: any) => s.language), audioTrack: (parsed.info.audioTracks || []).find((a: any) => a.id === raw.audioTrack?.id) }
    this.jobs.set(id, job); this.persist(); this.emit('updated', owner); this.pump()
    return job
  }
  pump() {
    for (const job of this.jobs.values()) {
      if (this.running >= this.config.concurrency) break
      if (job.status !== 'pending') continue
      this.running++; job.status = 'downloading'
      void this.run(job).catch(() => { job.status = 'error'; job.error = '任务保存失败' }).finally(() => { this.running--; this.pump() })
    }
  }
  async run(job: Job) {
    const dir = job.options.outputDir
    const abort = new AbortController()
    const timeout = setTimeout(() => { job.status = 'error'; job.error = '任务超时'; abort.abort(); void pauseDownload(job.id) }, this.config.taskTimeout)
    const sizeCheck = setInterval(() => {
      try {
        const size = fs.readdirSync(dir).reduce((sum, name) => sum + fs.statSync(path.join(dir, name)).size, 0)
        if (size > this.config.maxFileBytes) { job.status = 'error'; job.error = '文件超过大小限制'; void pauseDownload(job.id) }
      } catch {}
    }, 2000)
    try {
      fs.mkdirSync(dir, { recursive: true })
      const result = await runYtdlpDownload(job.options, dir)
      if (job.status !== 'downloading' || result.paused) { if (job.status === 'downloading') job.status = 'paused'; return }
      const filePath = result.filePath
      if (!filePath || !path.resolve(filePath).startsWith(path.resolve(dir) + path.sep)) throw new Error('没有生成可下载文件')
      job.localPath = filePath
      job.file = await this.storage.save(filePath, job.owner + '/' + job.id + '/' + path.basename(filePath), abort)
      if (job.status !== 'downloading') { await this.storage.remove(job.file); delete job.file; return }
      job.status = 'completed'; job.progress = 100
      if (this.config.storage === 'r2') fs.rmSync(dir, { recursive: true, force: true })
    } catch { job.status = 'error'; job.error ||= '下载或保存失败，请重试或选择其他格式' }
    finally {
      clearTimeout(timeout); clearInterval(sizeCheck)
      if (job.status !== 'completed') fs.rmSync(dir, { recursive: true, force: true })
      delete job.options
      this.persist(); this.emit('finished', job); this.emit('updated', job.owner)
    }
  }
  async pause(owner: string, clientId: string) {
    const job = [...this.jobs.values()].find(j => j.owner === owner && j.clientId === clientId && ['pending', 'downloading'].includes(j.status))
    if (!job) return
    const pending = job.status === 'pending'
    job.status = 'paused'
    await pauseDownload(job.id)
    if (pending) { delete job.options; this.emit('finished', job) }
    this.persist()
  }
  async remove(owner: string, id: string) {
    const job = this.jobs.get(id)
    if (!job || job.owner !== owner || ['pending', 'downloading'].includes(job.status)) throw new Error('任务不存在或仍在运行')
    if (job.file) await this.storage.remove(job.file)
    fs.rmSync(path.join(this.config.workDir, id), { recursive: true, force: true })
    this.jobs.delete(id); this.persist()
  }
  async cleanup() {
    for (const job of this.jobs.values()) {
      if (Date.now() - job.createdAt > this.config.ttl && !['pending', 'downloading'].includes(job.status)) {
        try { await this.remove(job.owner, job.id) } catch { /* 保留清单，下次继续删除。 */ }
      }
    }
    for (const [key, value] of this.parsed) if (Date.now() - value.time > 20 * 60000) this.parsed.delete(key)
  }
}
