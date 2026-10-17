import http from 'node:http'
import net from 'node:net'
import { publicTarget } from './security'

/** 下载代理逐次检查目标并固定解析结果，重定向也必须重新检查。 */
export async function startEgress() {
  const server = http.createServer(async (req, res) => {
    try {
      const { url, address } = await publicTarget(req.url || '')
      if (url.protocol !== 'http:') throw new Error('协议错误')
      const upstream = http.request({ hostname: address, port: url.port || 80, path: url.pathname + url.search, method: req.method, headers: { ...req.headers, host: url.host } }, response => {
        res.writeHead(response.statusCode || 502, response.headers)
        response.pipe(res)
      })
      upstream.setTimeout(30000, () => upstream.destroy())
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
      req.on('aborted', () => upstream.destroy())
      req.pipe(upstream)
    } catch { res.writeHead(403).end() }
  })
  server.on('connect', async (req, socket, head) => {
    try {
      const { url, address } = await publicTarget('https://' + req.url)
      const remote = net.connect(Number(url.port || 443), address, () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length) remote.write(head)
        remote.pipe(socket); socket.pipe(remote)
      })
      remote.setTimeout(60000, () => remote.destroy())
      remote.on('error', () => socket.destroy())
      socket.on('error', () => remote.destroy())
      socket.on('close', () => remote.destroy())
    } catch { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n') }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as net.AddressInfo
  return { server, url: 'http://127.0.0.1:' + address.port }
}
