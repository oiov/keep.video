# Keep Video 网站

默认英语位于根目录。简体中文 /zh/、西班牙语 /es/、巴西葡萄牙语 /pt-br/、德语 /de/、法语 /fr/、日语 /ja/、韩语 /ko/、俄语 /ru/。共 117 个静态页面，语言选择保留当前页面，旧 /en/ 地址永久跳转到根目录对应页面。

node scripts/build-website.mjs 构建，node scripts/serve-website.mjs 本地预览，node scripts/lint-website.mjs 校验。Cloudflare Workers 通过 GitHub Actions 自动部署，正式域名 https://keep.video，联系邮箱 support@keep.video。

content.mjs 和 platforms.mjs 保留中英内容；locales/*.json 保存另外七种语言。缺失翻译会阻止构建，不静默回退。新增文案需要同步所有语言。翻译使用机器初稿并经模型复核和本地化调整，尚未经母语人工审校。

构建生成 sitemap.xml、robots.txt、llms.txt、canonical、九语言 hreflang 和英语 x-default。SITE_PREVIEW=1 强制 noindex，SITE_URL 空值用于无正式域名的校验。素材为本项目 AI 生成图和实际客户端截图。

在线工具使用同一份导航与语言配置，默认 /app/，中文 /zh/app/；旧 /zh-cn/ 地址永久跳转。pnpm build:web 构建完整站点与交互脚本，pnpm start:web 启动同域预览。公开 HTML 含使用步骤、FAQ 与 WebApplication / FAQPage 结构化数据；不根据访客是否为机器人切换内容。
