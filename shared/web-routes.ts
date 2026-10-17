import locales from './site-locales.json'

/** 公开在线页与门户共用语言路径；资源始终从 /app/ 加载。 */
export function webLocale(pathname: string) {
  return locales.find(locale => pathname === `/${locale.prefix ? locale.prefix + '/' : ''}app/`)
}

export function isWebPage(pathname: string): boolean {
  return Boolean(webLocale(pathname))
}
