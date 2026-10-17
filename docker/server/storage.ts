import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { Config } from './config'

export interface StoredFile { key: string; name: string; size: number; driver: string }

/** R2 使用私有桶，通过本站鉴权后流式转发，不依赖公开桶或跨域设置。 */
export function createStorage(config: Config) {
  const client = config.storage === 'r2' ? new S3Client({ region: 'auto', endpoint: config.r2.endpoint, credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' }) : undefined
  return {
    async save(filePath: string, key: string, abortController = new AbortController()): Promise<StoredFile> {
      const stat = await fs.promises.stat(filePath)
      if (!stat.isFile() || stat.size > config.maxFileBytes) throw new Error('文件超过存储上限')
      if (client) {
        await new Upload({ client, abortController, params: { Bucket: config.r2.bucket, Key: key, Body: fs.createReadStream(filePath), ContentType: 'application/octet-stream' }, queueSize: 2, partSize: 8 * 1024 * 1024 }).done()
      }
      return { key, name: path.basename(filePath), size: stat.size, driver: config.storage }
    },
    async open(file: StoredFile, localPath: string, range?: string) {
      if (client) {
        const result = await client.send(new GetObjectCommand({ Bucket: config.r2.bucket, Key: file.key, Range: range }))
        return { stream: result.Body as Readable, size: result.ContentLength!, contentRange: result.ContentRange }
      }
      const bounds = parseRange(range, file.size)
      return { stream: fs.createReadStream(localPath, bounds ? { start: bounds.start, end: bounds.end } : undefined), size: bounds ? bounds.end - bounds.start + 1 : file.size, contentRange: bounds ? `bytes ${bounds.start}-${bounds.end}/${file.size}` : undefined }
    },
    async remove(file: StoredFile) {
      if (client) await client.send(new DeleteObjectCommand({ Bucket: config.r2.bucket, Key: file.key }))
    },
  }
}

export function parseRange(range: string | undefined, size: number) {
  if (!range) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match || (!match[1] && !match[2])) throw new Error('无效的 Range')
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) throw new Error('无效的 Range')
  return { start, end }
}
