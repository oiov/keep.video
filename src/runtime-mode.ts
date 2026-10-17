/** Web 构建入口显式标记模式，桌面端不设置此标记。 */
export const isWeb = document.documentElement.dataset.runtime === 'web'
