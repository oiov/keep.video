import { classifyParseError, PARSE_MESSAGES } from './parse-error'

export const webErrorCodes = [...Object.keys(PARSE_MESSAGES), 'busy', 'queue-full', 'parse-quota', 'download-quota', 'parse-required', 'timeout', 'too-large', 'storage', 'stopping', 'interrupted', 'stop-failed'] as const
export class WebError extends Error {
  constructor(public code: string, message: string, public retryAfterSeconds?: number) { super(message) }
}
export const isSourceRestriction = (code: unknown) => code === 'verification-required' || code === 'authentication'
/** 只返回安全类别，绝不向浏览器透传下载器或系统错误。 */
export function webErrorCode(error: unknown): string {
  if (error instanceof WebError && webErrorCodes.includes(error.code)) return error.code
  const message = error && typeof error === 'object' && 'message' in error ? error.message : ''
  if (typeof message === 'string' && /\[\[deps-missing:(?:yt-dlp|ffmpeg|ffprobe)\]\]/.test(message)) return 'runtime-unavailable'
  return classifyParseError(typeof message === 'string' ? message : '')
}
export function webErrorKey(code: unknown): string {
  if (typeof code !== 'string' || !webErrorCodes.includes(code)) return 'web.requestFailed'
  return Object.prototype.hasOwnProperty.call(PARSE_MESSAGES, code) ? 'web.parse.' + code : 'web.error.' + code
}
