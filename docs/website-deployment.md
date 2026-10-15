# Cloudflare Workers 部署

官网使用 Workers Static Assets。配置为 wrangler.jsonc，输出为 website/dist。

向 main 推送网站修改，或手动运行 Deploy Keep Video Website。Actions secrets 需要 CLOUDFLARE_API_TOKEN 和 CLOUDFLARE_ACCOUNT_ID，Token 需要 Workers 部署权限。

在 Cloudflare Worker 设置添加 Custom Domain，在 GitHub Actions variables 设置 SITE_URL 为正式 HTTPS 根域地址，然后重新部署。构建自动生成 canonical、hreflang 和 sitemap.xml。未配置域名时 workers.dev 仅用于预览，页面为 noindex。

Build & Release 工作流填写与 package.json 一致的版本即可生成安装包。发布成功后设置 website/config.mjs 的 releaseAvailable 为 true。所有下载与客户端更新均使用 oiov/download。
