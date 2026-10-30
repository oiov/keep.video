import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '../../src/style.css'
import ToolApp from '../../src/components/ToolApp.vue'

/**
 * 工具挂载本体。由 tool-entry.ts 动态导入：
 * 动态导入的 CSS 会被运行时的预加载助手注入，静态导入会被抽成无人引用的独立文件。
 */

window.addEventListener('error', (event) => {
  console.error('[Renderer Error]', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Renderer UnhandledRejection]', event.reason)
})

const app = createApp(ToolApp)
app.use(createPinia())

app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue Error]', err, info)
}

app.mount('#app')
