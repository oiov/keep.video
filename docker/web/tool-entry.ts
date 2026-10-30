import './bridge'
import { registerWebMessages, setLocale, type Locale } from '../../src/i18n'
import translations from '../../src/i18n/web-locales.json'
import { webLocale } from '../../shared/web-routes'

/**
 * 内容页里的精简工具入口。
 *
 * 与 /app/ 的区别只有一处：不挂载页头、标签页与设置，那些是工作台的导航，
 * 放进内容页会把用户从搜索词的语境里拽走。桥接、词条、表单与队列全部复用。
 *
 * 组件与样式必须动态导入：静态导入会被 Vite 抽成没有引用的独立 CSS 文件，
 * 页面就会退化成浏览器默认样式。
 */

registerWebMessages(translations)
document.documentElement.dataset.runtime = 'web'

// 语言在挂载前定好，晚一步会让首帧闪成另一种语言。
setLocale((webLocale(location.pathname)?.appLocale || 'en-US') as Locale)

void import('./style.css').then(() => import('./tool-mount'))
