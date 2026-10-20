import { execFile } from 'node:child_process'
import path from 'node:path'

interface DownloadChild {
  pid?: number
  exitCode: number | null
  signalCode: NodeJS.Signals | null
  kill(signal?: NodeJS.Signals | number): boolean
}

export function treeSpawnOptions(platform: NodeJS.Platform = process.platform) {
  return { detached: platform !== 'win32', windowsHide: true }
}

/** 暂停必须等整组退出；父进程先退出不代表 aria2 / ffmpeg 已停止写入。 */
export async function killProcessTree(child: DownloadChild, platform: NodeJS.Platform = process.platform): Promise<void> {
  const pid = child.pid
  if (!pid) return
  if (platform === 'win32') {
    await new Promise<void>((resolve, reject) => {
      execFile(path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
        ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, error => {
          if (!error) { resolve(); return }
          // 父进程退出不能证明整树已退出；失败时不先杀父进程，也不确认暂停。
          reject(new Error('无法停止下载进程，请稍后重试'))
        })
    })
    return
  }

  const signal = (value: NodeJS.Signals | 0) => {
    try { process.kill(-pid, value); return true }
    catch (error: any) {
      if (error?.code === 'ESRCH') return false
      throw error
    }
  }
  const waitGone = async (milliseconds: number) => {
    const deadline = Date.now() + milliseconds
    while (signal(0)) {
      if (Date.now() >= deadline) return false
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    return true
  }
  if (!signal('SIGTERM')) return
  if (await waitGone(1500)) return
  signal('SIGKILL')
  if (!await waitGone(2000)) throw new Error('无法停止下载进程，请稍后重试')
}
