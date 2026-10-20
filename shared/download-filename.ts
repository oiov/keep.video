/** 只对新视频任务补格式后缀；旧暂停任务和用户已区分画质的模板保持不变。 */
export function videoFilenameTemplate(template: string): string {
  const value = template || '%(title)s.%(ext)s'
  if (/%\((?:height|width|resolution|fps|format_id|format|quality)[,)\s]/.test(value) || /\[\d{3,4}p\]/i.test(value)) return value
  const suffix = ' [%(format_id)s]'
  const index = value.lastIndexOf('.%(ext)')
  return index < 0 ? value + suffix : value.slice(0, index) + suffix + value.slice(index)
}
