# Keep Video 网站

默认英语位于根目录。简体中文 /zh/、西班牙语 /es/、巴西葡萄牙语 /pt-br/、德语 /de/、法语 /fr/、日语 /ja/、韩语 /ko/、俄语 /ru/。共 117 个静态页面，语言选择保留当前页面，旧 /en/ 地址永久跳转到根目录对应页面。

node scripts/build-website.mjs 构建，node scripts/serve-website.mjs 本地预览，node scripts/lint-website.mjs 校验。Cloudflare Workers 通过 GitHub Actions 自动部署，正式域名 https://keep.video，联系邮箱 support@keep.video。

content.mjs 和 platforms.mjs 保留中英内容；locales/*.json 保存另外七种语言。缺失翻译会阻止构建，不静默回退。新增文案需要同步所有语言。翻译使用机器初稿并经模型复核和本地化调整，尚未经母语人工审校。

构建生成 sitemap.xml、robots.txt、llms.txt、canonical、九语言 hreflang 和英语 x-default。SITE_PREVIEW=1 强制 noindex，SITE_URL 空值用于无正式域名的校验。素材为本项目 AI 生成图和实际客户端截图。

在线工具使用同一份导航与语言配置，默认 /app/，中文 /zh/app/；旧 /zh-cn/ 地址永久跳转。pnpm build:web 构建完整站点与交互脚本，pnpm start:web 启动同域预览。公开 HTML 含使用步骤、FAQ 与 WebApplication / FAQPage 结构化数据；不根据访客是否为机器人切换内容。

## 访问统计

九语言公开页面和在线工具页共用 `scripts/build-website.mjs` 的 `<head>` 模板，保留 Umami，并接入 Google Analytics 4。衡量 ID 在 `website/config.mjs` 的 `googleAnalyticsId` 中统一配置，当前为 `G-88W870PGZH`；这是公开站点标识，不是密钥。

GA4 仅在构建域名与 `site.origin` 一致、且非预览构建时注入。`SITE_PREVIEW=1`、`VERCEL_ENV=preview`、空 `SITE_URL` 或其他构建域名均不注入；浏览器运行时也会核对来源，所以把正式产物放到 localhost 或其他域名预览不会加载 Google 脚本。根目录 `index.html` 属于 Electron 桌面应用，不添加统计代码。以上限制仅针对 GA4，Umami 的原有行为不变。

修改后执行 `pnpm build:web` 和 `pnpm lint:website`，重新构建并部署站点镜像；仅修改容器运行时环境变量不会改变已经生成的 HTML。上线后访问 `https://keep.video/` 或 `/zh/app/`，在 GA4 的「实时」报告中确认访问。广告拦截或网络限制可能阻止统计请求。

本次仅接入 Google tag 的默认统计，没有添加视频链接、任务或文件内容的自定义上报。GA4 可能使用 Cookie，Google 后台的增强型衡量也会影响采集范围；上线前应按面向地区的要求完善隐私说明与 Cookie 同意机制，本次未新增同意管理组件。
