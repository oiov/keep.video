import locales from './site-locales.json'
import toolSlugs from './tool-routes.json'

/**
 * 带工具的页面路径。会话 Cookie 只在这些路径下发，WebSocket 握手依赖它。
 * 新增可放工具的页面时改 shared/tool-routes.json——生成器读同一份，两边不会漂移。
 */
export const TOOL_SLUGS: string[] = toolSlugs

/** 当前路径是否是某个带工具的页面；返回语言表条目，不是则返回 undefined。 */
export function webLocale(pathname: string) {
  return locales.find(locale => {
    const base = `/${locale.prefix ? locale.prefix + '/' : ''}`
    return TOOL_SLUGS.some(slug => pathname === `${base}${slug}/`)
  })
}

export function isWebPage(pathname: string): boolean {
  return Boolean(webLocale(pathname))
}
