import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/** 临时文件与目标位于同一目录，写入和落盘失败都不覆盖原文件。 */
export function writeFileAtomic(file: string, contents: string) {
  const temporary = `${file}.${randomUUID()}.part`
  let descriptor: number | undefined
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600)
    fs.writeFileSync(descriptor, contents, 'utf8')
    fs.fsyncSync(descriptor)
    fs.closeSync(descriptor)
    descriptor = undefined
    fs.renameSync(temporary, file)
    // Windows 不支持打开目录；支持的平台额外持久化 rename 的目录项。
    let directory: number | undefined
    try {
      directory = fs.openSync(path.dirname(file), 'r')
      fs.fsyncSync(directory)
    } catch {} finally { if (directory !== undefined) { try { fs.closeSync(directory) } catch {} } }
  } finally {
    // 清理失败不能掩盖写入失败，更不能把已完成的 rename 误报为未保存。
    if (descriptor !== undefined) { try { fs.closeSync(descriptor) } catch {} }
    try { fs.rmSync(temporary, { force: true }) } catch {}
  }
}
