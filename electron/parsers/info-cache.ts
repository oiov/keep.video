import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const PARSE_CACHE_LIMIT = 100
export const PARSE_CACHE_TTL = 30 * 60 * 1000
const entries = new Map<string, { url: string; data: any; time: number; extractorArgs: string[] }>()
const files = new Map<string, { readers: number; retired: boolean; extractorArgs: string[] }>()
let directory = ''

function removeFile(file: string) {
  const state = files.get(file)
  if (!state || !state.retired || state.readers) return
  try { fs.rmSync(file, { force: true }); files.delete(file) } catch { /* 退出时再次清理。 */ }
}

function evict(key: string) {
  const entry = entries.get(key)
  entries.delete(key)
  const file = entry?.data.cacheFile
  const state = files.get(file)
  if (state) { state.retired = true; removeFile(file) }
}

function prune() {
  for (const [key, entry] of entries) if (Date.now() - entry.time >= PARSE_CACHE_TTL) evict(key)
  while (entries.size > PARSE_CACHE_LIMIT) evict(entries.keys().next().value!)
}

export function getCachedParse(key: string): any {
  prune()
  const entry = entries.get(key)
  if (!entry) return undefined
  entries.delete(key)
  entries.set(key, entry)
  return entry.data
}

export function cacheParsedInfo(key: string, url: string, data: any, json: string, extractorArgs: string[]) {
  evict(key)
  try {
    // 私有目录和随机文件名同时隔离进程、相同视频及不同 Cookie / 代理的解析。
    if (!directory) directory = fs.mkdtempSync(path.join(os.tmpdir(), 'downvid-parse-'))
    const file = path.join(directory, randomUUID() + '.json')
    fs.writeFileSync(file, json, { flag: 'wx', mode: 0o600 })
    files.set(file, { readers: 0, retired: false, extractorArgs: [...extractorArgs] })
    data.cacheFile = file
  } catch { /* 缓存写入失败时仍可按 URL 下载。 */ }
  entries.set(key, { url, data, time: Date.now(), extractorArgs: [...extractorArgs] })
  prune()
}

export function getExtractorArgs(url: string, file?: string): string[] {
  prune()
  if (file) return files.get(file)?.extractorArgs.slice() || []
  return [...entries.values()].reverse().find(entry => entry.url === url)?.extractorArgs.slice() || []
}

/** 淘汰只移除缓存索引，已启动的下载在退出前仍持有原始 JSON。 */
export function retainInfoFile(file?: string): () => void {
  const state = file ? files.get(file) : undefined
  if (state) state.readers++
  let released = false
  return () => {
    if (released || !state || !file) return
    released = true
    state.readers--
    removeFile(file)
  }
}

/** 仅用于进程退出；正常淘汰必须尊重下载引用。 */
export function clearParseCache() {
  entries.clear()
  files.clear()
  if (directory) {
    try { fs.rmSync(directory, { recursive: true, force: true }) } catch {}
    directory = ''
  }
}

process.once('exit', clearParseCache)
