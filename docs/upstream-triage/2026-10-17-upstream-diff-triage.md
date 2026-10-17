# 上游 WebUI 集成评估（2026-10-17）

## 基线与范围

- 当前分支 main：75572cd3dc06c1a3ed2c17d3535475fe4c7f4145，fix(triage): 手工提交的占位垃圾 Issue 没被识别（#60）。
- 用户基准 origin/main：https://github.com/oiov/download.git，f88bc3d4741f41f91c03585d372c2a90e35d1809，Update footer links and fix issue template name regression；feat/website-seo 同指此提交。
- 上游 upstream/main：https://github.com/yxxbc/downvid.git，ba97e1d053f8c3c3ef413d83139912d11cb0fcef，build(deps): bump the minor-and-patch group across 1 directory with 9 updates (#81)。
- 已拉取两个远端。共同祖先与最近继承的上游同步点均为 75572cd，是当前 HEAD 和用户基准的祖先。最新上游不是用户基准的祖先。
- 按祖先关系：用户基准独有 12 个提交，上游独有 9 个；当前 HEAD 相对上游为 0 / 9。
- 工作区存在未跟踪的 work/，评估不改动其内容。
- 范围：保留 keep.video / Framekeep 品牌、SEO 页面、多语言与发布坐标；评估 WebUI、容器服务与桌面共享逻辑，不能用上游官网覆盖 SEO 网站。
- 当前只做实现核查与合并预演，未合并代码、切换分支或部署。

## 候选初筛

| 提交 | 子系统 | 分类 | 状态 | 初步处理 |
| --- | --- | --- | --- | --- |
| 82cb7bd | Docker / WebUI | Inspect | needs inspection | 核查架构和冲突 |
| 4916f48 | 服务端设计稿 | Inspect | needs inspection | 与实现交叉核对 |
| f09c5ee | Cookie 回退 | Inspect | needs inspection | 核查适用性 |
| 4e52829 | 测试 | Inspect | needs inspection | 核查适用性 |
| cc45633 | 上游官网 | Skip | not applied | 保留本地 SEO 网站 |
| 7db0c39 | 发布 / 文档 | Inspect | needs inspection | 排除版本和品牌覆盖 |
| f39bc19 | Product Hunt | Skip | not applied | 不复用上游营销入口 |
| 2d105fc | 品牌说明 | Inspect | needs inspection | 核查署名约束 |
| ba97e1d | 依赖更新 | Inspect | needs inspection | 核查兼容范围 |

## 待补充

运行边界、API 与认证、SEO 路由、冲突清单、分批集成与验证。

## 用户补充的部署约束

- 现有 SEO 网站继续部署在 Cloudflare Worker，必须保留自定义 SEO。
- 用户有可运行容器的服务器，评估服务器部署 WebUI 和下载引擎。
- 需要评估并完善 fork 的 GitHub Actions 镜像构建发布及方便服务器更新的配置。

## 最终部署约束（覆盖前述 Worker 保留方案）

- 用户明确要求：SEO 门户和 WebUI 整合到同一个 keep.video，整个站点部署到自有服务器，不再使用 Worker。
- 不采用独立 app 子域名；建议同源 /app/ 承载工具界面，原有 SEO 路径保持。
- 镜像需要同时包含 SEO 静态产物、WebUI 静态产物、Node 下载服务和运行依赖；Actions 发布镜像，服务器拉取运行。
- 当前任务为上游比较与集成方案评估；不在缺少服务器信息时执行生产部署。

## 最终结论与预演结果

以 origin/main 为基准，手工移植 WebUI，不全量合并上游。单个应用镜像包含 SEO 静态站、WebUI、Node 服务与下载依赖，部署到服务器；HTTPS 由反向代理提供。

- 全量合并预演有 11 个冲突文件：.gitignore、AGENTS.md、CLAUDE.md、README.md、README.zh-CN.md、package.json、scripts/gen-website-stats.mjs、scripts/lint-website.mjs、src/components/AboutView.vue、website/README.md、website/index.html。
- 单独以 82cb7bd 父提交为基线预演该补丁，仅 5 个冲突：.gitignore、AGENTS.md、CLAUDE.md、README.md、README.zh-CN.md。文本合并成功不代表运行通过。
- 全量预演中 shared/app.ts 无文本冲突，却产生两个 WEBSITE_URL，分别指向上游和 keep.video，并带入上游联系方式。必须手工适配。
- 用户已经删除上游 website/index.html，改用静态生成站点；不能恢复上游官网及其专用版本测试。

## 最终候选处置（覆盖初筛）

| 提交 | 分类 | 状态 | 动作 |
| --- | --- | --- | --- |
| f09c5ee | Backport now | not applied | 用户未修改该 Cookie 实现；移植 SQLite 坏库识别与正反向用例 |
| 82cb7bd | Manual backport | not applied | 移植 WebUI、服务、桥接和测试，适配同域站点与本项目镜像 |
| 2d105fc | Manual backport | not applied | 保留许可和来源说明，使用独立 Keep Video 品牌 |
| 4916f48 | Conditional | not applied | 仅作历史设计参考，仍标注尚未实现，不能当现行部署文档 |
| 4e52829 | Manual backport | not applied | 参考浅克隆测试修复，按用户贡献者名单适配；跳过单文件官网测试 |
| cc45633 | Skip | skip | 保留用户 SEO 站点，不引入上游官网 |
| 7db0c39 | Manual backport | not applied | 挑相关文档，不覆盖本项目版本、品牌与联系方式 |
| f39bc19 | Skip | skip | 不引入上游营销入口 |
| ba97e1d | Conditional | not applied | 依赖更新独立验证，避免混入架构改造 |

## 同域站点结构

| 路径 | 用途 |
| --- | --- |
| / 及现有语言、指南、平台路径 | website/dist 静态 SEO 页面 |
| /download/ | 保留桌面客户端下载页 |
| /app/ | WebUI，仅此空间允许 SPA 回退 |
| /api/ws | 同源任务与进度 WebSocket |
| /api/files/:id | 新增授权成品文件下载 |
| /healthz | 容器健康检查 |
| /sitemap.xml、/robots.txt、/llms.txt | 保留搜索发现产物 |

构建顺序：生成 SEO 网站，构建 base=/app/ 的 WebUI，编译 Go 侧车；运行镜像包含两份静态产物、Node、yt-dlp、ffmpeg。服务按路径分发，隔离 assets。

SEO 保留要求：九语言 URL、title、description、canonical、hreflang、JSON-LD 和正文保持；未知门户路径返回真实 404。Worker 的尾斜杠规范化以及 _redirects 中 /en 到 / 的跳转必须实现为服务器 HTTP 重定向，复制文件不会自动生效。

首页和平台页增加在线使用，工具页可返回门户；保留桌面下载入口。更新正文、元数据和 llms.txt 中“仅桌面、不在网站解析”的描述。应用目前仅中英双语，不等于门户九语言；新增文案按各自体系同步。工具页和私有结果设置适当 noindex，用户任务不进入 sitemap。

停用 Worker 部署工作流。生产切换时移除旧 Worker 自定义域绑定，将 keep.video 接到服务器，保持原 URL。

## 公开使用前的实际缺口

- 上游 HTTP 仅提供健康探针和静态资源，下载只返回服务器 filePath；新增访客保存按钮、授权文件接口、Content-Disposition、流式交付与过期提示。
- 服务共用历史文件，并向所有连接广播进度和历史。需要服务端会话隔离任务、事件与文件；首版可用匿名会话，无须先建设账号系统。
- 现有 3 任务限制在各浏览器 Pinia 中。需要服务端总并发、单会话配额、磁盘预算，刷新后可重新查询任务。
- 不向公开访客暴露 outputDir、cookiesFile、依赖路径、proxy 与日志管理等服务器管理能力。
- fetchImage 直接请求用户 URL；解析和下载也访问远端。限制协议、私网/回环/元数据地址及重定向目标，配合执行环境网络隔离。Origin 校验不能替代身份与权限，上游允许无 Origin 客户端。
- 上游用 DOM 位置选择器隐藏桌面按钮，本项目改过组件，需换成显式运行模式；固定返回成功的代理测试等占位行为不能直接展示。
- 明确文件保存期限、取消和失败清理、磁盘满行为；服务器向访客交付成品消耗出站带宽。

## 镜像 Actions 与生产部署

上游已有 docker.yml，可复用框架，需修复：

1. publish job 添加 packages: write，目前仅有 contents: read。
2. 镜像使用本项目坐标，例如 ghcr.io/oiov/keep.video；修复两次 tags= 写同一输出导致无法保留两标签的问题，采用多行输出或 metadata action。明确版本、SHA、latest 策略和允许发布的分支。
3. PR 触发范围覆盖 website/、src/、electron/、shared/、脚本与锁文件，现有过滤只关注容器文件。
4. 打包两份前端；运行 SEO、Web 回归及容器验收，覆盖门户、语言页、/app/ 资源、WebSocket、404 与文件交付。当前冒烟仅验证健康探针和首页挂载点。
5. 对承诺支持的架构实际冒烟；上游只冒烟 amd64，arm64 仅构建发布。发布后核验远端 manifest/digest，不只打印标签。
6. 提供直接拉取固定版本镜像的生产 Compose，保留数据卷、健康检查和重启策略；应用端口仅供 HTTPS 反向代理访问。服务器无需拉源码编译。
7. 更新时拉取固定版本并重建，保留上一版本或 digest 可回滚；实际发布时配置镜像可见性或拉取凭据。

## 实施批次与验证

1. 从 origin/main 建 feat/webui-integration，移植 Cookie 修复与 WebUI，保持本项目版本和桌面更新坐标。
2. 整合同域门户与 /app/，扩展 SEO 和重定向/404 校验，验证移动端。
3. 完成服务端会话、队列和文件交付，验证双访客隔离、刷新后查询、取消和过期清理。
4. 完善镜像、Actions、生产 Compose 和中文部署文档，同步 AGENTS.md / CLAUDE.md，停用 Worker 工作流。

实施后按仓库要求全跑类型检查、逻辑及集成回归、IPC/图标/i18n/官网/文档/工作流校验、Go 检查、构建和产物验证。新增测试做变异验证；CI 改动复现非宿主语义；容器实际构建启动验收。

本次只完成远端刷新、祖先核对、代码阅读、两种合并预演及评估文档。未切分支、合并实现、运行应用测试、发布镜像或部署服务器。


## 实施进展

已从 origin/main 创建 feat/webui-integration；移植 Cookie 修复与 WebUI 基础，新增服务器队列、会话隔离、文件交付和 local/R2 存储，统一门户与 /app/。新增镜像工作流和部署说明。用户已授权推送分支并由 GitHub Actions 实际构建验收。前述“尚未修改实现”描述仅记录初次评估时状态。
