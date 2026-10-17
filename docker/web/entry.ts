import './bridge'
import { registerWebMessages } from '../../src/i18n'
import translations from '../../src/i18n/web-locales.json'
registerWebMessages(translations)
document.documentElement.dataset.runtime = 'web'
// 动态加载确保模式标记先于组件模块执行。
void import('./style.css').then(() => import('../../src/main'))
