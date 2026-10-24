import { t } from '../../src/i18n'
import { webErrorKey } from '../../shared/web-errors'
import { browserContext } from './analytics'

/**
 * Web 环境的 window.electronAPI 适配器。
 *
 * 位于 docker/web/ 独立目录中，不侵入 src/ 下的任何桌面代码。
 * 纯前端通过 WebSocket RPC 与 docker/server 通信，模拟完整的 window.electronAPI。
 */

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

export function installWebBridge() {
  if (typeof window === 'undefined' || window.electronAPI) return

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${proto}//${location.host}/api/ws`

  const pending = new Map<number, Pending>()
  const subscribers = new Map<string, Set<(data: unknown) => void>>()
  let nextId = 1
  let socket: WebSocket | null = null
  let connecting: Promise<WebSocket> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retryDelay = 1000
  let initialized = false
  const localize = (value: any): any => Array.isArray(value) ? value.map(localize) : value?.errorCode ? { ...value, error: t(webErrorKey(value.errorCode)) } : value
  const publish = (name: string, data: any) => { for (const cb of subscribers.get(name) || []) cb(localize(data)) }
  const rpcError = (code?: string) => Object.assign(new Error(t(webErrorKey(code))), { code })

  function reconnect() {
    if (retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      void connect().catch(() => reconnect())
    }, retryDelay)
    retryDelay = Math.min(retryDelay * 2, 15000)
  }

  function connect(): Promise<WebSocket> {
    if (socket?.readyState === WebSocket.OPEN) return Promise.resolve(socket)
    if (connecting) return connecting
    connecting = new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      const failTimer = setTimeout(() => {
        ws.close()
        reject(new Error(t('web.connectFailed')))
      }, 10_000)
      ws.onopen = () => {
        clearTimeout(failTimer)
        socket = ws
        connecting = null
        retryDelay = 1000
        clearTimeout(retryTimer); retryTimer = undefined
        resolve(ws)
        if (initialized) void invoke('history:get').then(data => publish('history:updated', data)).catch(() => {})
        initialized = true
        window.dispatchEvent(new CustomEvent('keep:connection', { detail: 'connected' }))
      }
      ws.onerror = () => {
        clearTimeout(failTimer)
        reject(new Error(t('web.connectFailed')))
      }
      ws.onclose = () => {
        clearTimeout(failTimer)
        reject(new Error(t('web.connectFailed')))
        socket = null
        connecting = null
        for (const [, entry] of pending) entry.reject(Object.assign(new Error(t('web.disconnected')), { code: 'disconnected' }))
        pending.clear()
        window.dispatchEvent(new CustomEvent('keep:connection', { detail: 'disconnected' }))
        reconnect()
      }
      ws.onmessage = (ev) => {
        let message: any
        try { message = JSON.parse(String(ev.data)) } catch { return }
        if (message.event !== undefined) {
          publish(message.event, message.data)
          return
        }
        if (message.id !== undefined) {
          const entry = pending.get(message.id)
          if (!entry) return
          pending.delete(message.id)
          if (message.error) entry.reject(rpcError(message.errorCode))
          else entry.resolve(localize(message.result))
        }
      }
    })
    return connecting
  }

  function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return connect().then(ws => new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      try { ws.send(JSON.stringify({ id, channel, args, context: browserContext(channel === 'ytdlp:parse' ? args[0] as string : undefined) })) }
      catch { pending.delete(id); reject(Object.assign(new Error(t('web.disconnected')), { code: 'disconnected' })) }
    }))
  }

  function track(name: string, jobId?: string) {
    // 统计不建立额外连接、不等待回包、不重试；断网时直接丢弃。
    try {
      if (socket?.readyState !== WebSocket.OPEN) return
      socket.send(JSON.stringify({ id: nextId++, channel: 'analytics:event', args: [{ name, id: crypto.randomUUID(), jobId }], context: browserContext() }))
    } catch { /* 浏览器统计不可用不能影响交互。 */ }
  }
  window.addEventListener('keep:analytics', event => {
    const name = (event as CustomEvent).detail?.name
    if (name === 'tool_view') void connect().then(() => track(name)).catch(() => {})
    else if (name === 'example_selected') track(name)
  })
  async function saveFile(filePath: string) {
    if (!/^\/api\/files\/[a-zA-Z0-9-]+$/.test(filePath)) return { success: false, error: t('web.requestFailed') }
    track('file_save_clicked', filePath.split('/').pop())
    const response = await fetch(filePath, { method: 'HEAD', cache: 'no-store' }).catch(() => null)
    if (!response?.ok) return { success: false, error: t(response?.status === 404 ? 'web.expired' : 'web.requestFailed') }
    const link = document.createElement('a'); link.href = filePath; link.download = ''; link.click()
    return { success: true }
  }

  function subscribe(channel: string, callback: (data: any) => void): () => void {
    let set = subscribers.get(channel)
    if (!set) {
      set = new Set()
      subscribers.set(channel, set)
    }
    const wrapped = (data: unknown) => callback(data)
    set.add(wrapped)
    return () => { set?.delete(wrapped) }
  }

  window.electronAPI = {
    clipboard: {
      readText: async () => navigator.clipboard.readText(),
      writeText: async (text: string) => { await navigator.clipboard.writeText(text) },
    },

    dialog: {
      selectFolder: () => invoke('dialog:selectFolder'),
      selectFile: () => invoke('dialog:selectFile'),
    },

    app: {
      getVersion: () => invoke('app:getVersion'),
      getDefaultDownloadDir: () => invoke('app:getDefaultDownloadDir'),
      getHomeDir: () => invoke('app:getHomeDir'),
      cookieStatus: (manualFile?: string) => invoke('app:cookieStatus', manualFile),
      fetchImage: (url: string, referer?: string) => invoke('app:fetchImage', url, referer),
      getLog: () => invoke('app:getLog'),
      clearLog: () => invoke('app:clearLog'),
      openLogDir: () => invoke('app:openLogDir'),
      setProxy: (proxy: string) => invoke('app:setProxy', proxy),
      testProxy: (proxy: string) => invoke('app:testProxy', proxy),
      getDiskSpace: (dir?: string) => invoke('app:getDiskSpace', dir),
    },

    shell: {
      openPath: saveFile,
      showItemInFolder: saveFile,
      openExternal: (url: string) => { window.open(url, '_blank', 'noopener'); return Promise.resolve() },
    },

    ytdlp: {
      accelerationStatus: (manual?: string) => invoke('ytdlp:accelerationStatus', manual),
      parse: async (url: string, cookiesFile?: string, proxy?: string) => {
        const info: any = await invoke('ytdlp:parse', url, cookiesFile, proxy)
        // 引擎的展示标签固定为中文；网页按当前语言展示，来源标题保持原样。
        for (const format of info.formats || []) if (format.quality === '最佳画质') format.quality = t('settings.qualityBest')
        for (const format of info.audioFormats || []) if (format.quality === '音频') format.quality = t('formats.audioHeader', { count: 1 })
        if (info.parseNotice) info.parseNotice = ''
        return info
      },
      download: (options: any) => invoke('ytdlp:download', options),
      pauseDownload: (taskId: string) => invoke('ytdlp:pauseDownload', taskId),
    },

    deps: {
      status: (settings?: any, force?: boolean) => invoke('deps:status', settings, force),
      check: (settings?: any) => invoke('deps:check', settings),
      download: (options?: any) => invoke('deps:download', options),
      cancel: () => invoke('deps:cancel'),
      openDir: () => invoke('deps:openDir'),
      diagnostics: () => invoke('deps:diagnostics'),
      onProgress: (callback: (data: any) => void) => subscribe('deps:progress', callback),
    },

    onDownloadProgress: (callback: (data: any) => void) => subscribe('download:progress', callback),

    history: {
      get: () => invoke('history:get'),
      add: (record: any) => invoke('history:add', record),
      delete: (id: string) => invoke('history:delete', id),
      onUpdated: (callback: (history: any[]) => void) => subscribe('history:updated', callback),
    },

    checkForUpdates: () => invoke('app:checkForUpdates'),
    setUpdatePrefs: (prefs: { autoCheck?: boolean; autoDownload?: boolean }) => invoke('app:setUpdatePrefs', prefs),
    downloadUpdate: () => invoke('app:downloadUpdate'),
    installUpdate: () => invoke('app:installUpdate'),

    onUpdateStatus: (callback: (data: any) => void) => subscribe('update:status', callback),
    onMenuOpenSettings: () => () => {},
    onMenuShowAbout: () => () => {},

    window: {
      minimize: () => Promise.resolve(),
      maximize: () => Promise.resolve(),
      close: () => Promise.resolve(),
      isMaximized: () => Promise.resolve(false),
    },
  } as unknown as typeof window.electronAPI
}

installWebBridge()
