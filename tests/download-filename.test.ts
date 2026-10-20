import { describe, expect, it } from 'vitest'
import { videoFilenameTemplate } from '../shared/download-filename'

describe('新视频输出模板', () => {
  it('在扩展名前补格式标识，无扩展名模板也保留用户内容', () => {
    expect(videoFilenameTemplate('%(title)s.%(ext)s')).toBe('%(title)s [%(format_id)s].%(ext)s')
    expect(videoFilenameTemplate('clips/%(title).120B')).toBe('clips/%(title).120B [%(format_id)s]')
    expect(videoFilenameTemplate('')).toBe('%(title)s [%(format_id)s].%(ext)s')
  })
  it('保留用户已有的画质字段且重复处理幂等', () => {
    for (const template of ['%(title)s-%(height)sp.%(ext)s', '%(title)s-%(format_id)s', '%(title)s [1080p]']) {
      expect(videoFilenameTemplate(template)).toBe(template)
    }
    const template = videoFilenameTemplate('%(title)s')
    expect(videoFilenameTemplate(template)).toBe(template)
  })
})
