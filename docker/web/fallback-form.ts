/**
 * 官网在 #app 里预先渲染了可提交的静态表单，脚本到达前访客可能已经在里面粘贴了链接。
 * Vue 挂载会清空容器：挂载前取出输入，挂载后交给工具的输入框；地址栏预填优先，不覆盖。
 */
export function takeFallbackInput(): () => void {
  const input = document.querySelector<HTMLInputElement>('#app .tool-fallback input[name="url"]')
  const value = input?.value.trim() || ''
  const focused = Boolean(input && document.activeElement === input)
  return () => {
    const target = document.querySelector<HTMLTextAreaElement>('#video-url')
    if (!target) return
    if (value && !target.value.trim()) {
      target.value = value
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }
    if (focused) target.focus()
  }
}
