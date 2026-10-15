# Framekeep 产品网站

独立中文与英文 URL 的静态网站；仅使用 Node 内置模块生成，浏览器不需要执行 JavaScript。

## 开发

- pnpm website:build：生成 website/dist（不提交构建产物）。
- pnpm website:preview：在 http://127.0.0.1:4179 预览，包含正确的 404 和尾斜杠跳转。
- pnpm lint:website：验证双语页面、SEO 模式、资源和内部链接。

## 内容与设计

- website/config.mjs：产品名、正式域名、仓库及安装包发布状态。
- website/content.mjs：四篇指南的独立中英内容。
- scripts/build-website.mjs：首页、下载中心、指南模板及 SEO 输出。
- website/assets/site.css：响应式视觉样式；与桌面客户端主题独立。
- website/assets/hero-frame-light.webp、video-frame-light.webp、audio-frame-light.webp：本次通过 Nbility 生成的 Framekeep 专属浅色素材；提示词见 website/art-direction.json。
- website/assets/app-preview.png：继承自上游的当前客户端截图，保留 MIT 许可。
- website/assets/social.png：1200 × 630 网站分享预览。

目录包括首页、download、guides，以及 getting-started、audio、subtitles、troubleshooting 四篇指南。中文在根目录，完整英文对应在 /en/。普通链接、FAQ、目录在无 JavaScript 时均可操作。

## 域名与发布

域名暂未确定。配置文件 origin 留空；也可以在部署环境设置 SITE_URL=https://你的正式域名。仅接受不含路径的 HTTPS origin。部署到 Vercel 时使用根目录 vercel.json，构建不安装桌面依赖。

没有正式域名时，页面输出 noindex,follow、空 sitemap，并省略 canonical/hreflang/og:url。允许抓取以便搜索引擎读取 noindex。配置正式域名后，生产构建输出 canonical、相互对应的 hreflang 和完整 sitemap。VERCEL_ENV=preview 或 SITE_PREVIEW=1 始终禁用收录，即使已设置生产域名。

上线后提交 /sitemap.xml 到 Search Console，检查首页、英文页与一篇指南的实时抓取；不承诺排名和流量。不要把临时预览 URL 填到 SITE_URL。

新仓库尚无安装包，releaseAvailable=false 时明确提供上游版本入口。完成独立安装包发布、更新源和安装验证后，才设为 true。下载链接指向对应 Releases 页面，不猜测产物文件名。

品牌调整需要同步官网配置、截图分享图及客户端品牌；Git 仓库、客户端 shared/app.ts 与 electron-builder.json5 的更新源已指向 oiov/download。原有 website:stats 是上游单页工具，现已改为明确报错，防止把上游累计下载量当成本项目数据。
