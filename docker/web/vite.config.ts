import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

/**
 * WebUI 构建配置（仅 Docker/Web 专用，完全隔离在 docker/ 目录下）。
 *
 * 输入：docker/web/entry.ts（/app/ 工作台）、docker/web/tool-entry.ts（内容页精简工具）
 * 输出：docker/dist-web/entry.js 与 docker/dist-web/tool.js
 * HTML 一律由官网生成器渲染，本配置不生成任何页面。
 *
 * 完全不触碰根目录的 vite.config.ts 与 electron 构建链路。
 */

const ROOT = path.resolve(import.meta.dirname, '../..')

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  base: '/app/',
  resolve: {
    alias: {
      '@': path.resolve(ROOT, 'src'),
    },
  },
  build: {
    outDir: path.resolve(ROOT, 'docker/dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // 工作台入口：/app/ 页面引用它。
        entry: path.resolve(import.meta.dirname, 'entry.ts'),
        // 内容页精简入口：带工具的落地页引用它。
        tool: path.resolve(import.meta.dirname, 'tool-entry.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        // 入口名的 JS 必须稳定，HTML 里写死的是 entry.js 与 tool.js。
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    vue(),
  ],
})
