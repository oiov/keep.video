// 用真实 SDK 和本地 S3 协议端点验证存储，不需要线上桶凭据。
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createStorage } from '../docker/server/storage.ts'
import { readConfig } from '../docker/server/config.ts'
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keep-storage-'))
const source = path.join(dir, 'sample.mp4')
fs.writeFileSync(source, 'sample-media')
const objects = new Map()
const calls = []
const server = http.createServer(async (req, res) => {
  calls.push(req.method)
  const key = new URL(req.url, 'http://localhost').pathname
  if (req.method === 'PUT') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    objects.set(key, Buffer.concat(chunks)); res.setHeader('ETag', '"test"'); res.end(); return
  }
  const body = objects.get(key)
  if (req.method === 'DELETE') { objects.delete(key); res.writeHead(204).end(); return }
  if (!body) { res.writeHead(404).end(); return }
  res.setHeader('Content-Length', body.length); res.end(body)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const config = readConfig({})
  const local = createStorage(config)
  const file = await local.save(source, 'sample')
  const result = await local.open(file, source, 'bytes=0-5')
  const chunks = []; for await (const chunk of result.stream) chunks.push(chunk)
  assert.equal(Buffer.concat(chunks).toString(), 'sample')
  const r2 = createStorage({ ...config, storage: 'r2', r2: { endpoint: 'http://127.0.0.1:' + server.address().port, bucket: 'test', accessKeyId: 'test', secretAccessKey: 'test' } })
  const remote = await r2.save(source, 'owner/job/sample.mp4')
  const read = await r2.open(remote, '')
  const downloaded = []; for await (const chunk of read.stream) downloaded.push(chunk)
  assert.equal(Buffer.concat(downloaded).toString(), 'sample-media')
  await r2.remove(remote)
  assert.equal(objects.size, 0)
  assert.deepEqual(calls, ['PUT', 'GET', 'DELETE'])
  console.log('本地 Range 与 S3 SDK 上传、读取、删除通过')
} finally {
  await new Promise(resolve => server.close(resolve))
  fs.rmSync(dir, { recursive: true, force: true })
}
