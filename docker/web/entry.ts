import './bridge'
document.documentElement.dataset.runtime = 'web'
// 动态加载确保模式标记先于组件模块执行。
void import('../../src/main')
