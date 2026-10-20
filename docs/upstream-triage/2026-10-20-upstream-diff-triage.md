# 上游更新评估（2026-10-20）

## 用户授权的实施范围

- 用户已授权合入适用修复，并要求仔细检查，明确禁止引入上游 Logo、名称等品牌内容。
- 采用手工移植，不全量合并；实施下载可靠性、解析与持久化修复，以及可独立验证的容器供应链改进。可选更新源、桌面 zipapp / aria2 自动安装、依赖大批升级及 Wails / Svelte 架构迁移不混入本轮。
- 保持 `shared/app.ts`、品牌图片、产品名称、安装包命名、发布仓库、官网与九语言内容不变，并在结束时逐项对比基线。
- 已重新核对上游在线版构建：`docker/Dockerfile` 仍构建 `docker/web/` 的 Vue 前端和 `docker/server/` 的 Node 服务；新增 Go 服务入口只注册已移植的版本 / 历史接口，尚不是当前 Docker 下载服务的完整替代。
- 执行顺序：下载与依赖等待 → 解析缓存 / 版本与历史持久化 → 容器校验 → 回归、变异验证、构建和品牌审计。每批完成后在本报告补充实际结果。

## 检查范围与基线

本节及下方初次验证记录是实施前的检查快照；后续用户已授权手工移植，并进一步授权提交、推送及跟踪 Actions。实际实施和验证结果以文末追加记录为准。

- 初次请求只检查上游更新；随后已授权手工移植、提交与推送。保留 main 分支，不创建发布 tag 或桌面 Release；main 推送触发仓库现有 CI 和镜像工作流。
- 当前分支 `main`：`1013d00022cee3343bd54bb7253a87d4645dc745`，`fix(website): 修正九语言在线与桌面版 SEO 描述`。
- 用户远端 `origin/main`：`https://github.com/oiov/download.git`，与当前 HEAD 相同。
- 上游远端 `upstream/main`：`https://github.com/yxxbc/downvid.git`，`1dfe63cf0a880a0f8297a8ee1a80eeb32a69d11e`，提交日期 2026-10-19，主题为清理迁移遗留文件（`Remove trigger_line.txt as part of the restructuring plan for DownVid to eliminate dependencies on Videdown and establish a lightweight, cross-platform architecture.`）。
- 已执行两个远端的 `git fetch --prune --no-tags`；未导入上游版本标签，避免与 fork 的发布标签混用。
- 初始工作区干净；本次新增的文件只有本评估报告。
- 共同祖先 / 最后通过祖先关系继承的上游点：`75572cd3dc06c1a3ed2c17d3535475fe4c7f4145`，是 HEAD 的祖先。
- 上次检查的上游点：`ba97e1d053f8c3c3ef413d83139912d11cb0fcef`，不是 HEAD 的祖先；随后本地 `cc68412` 手工移植了部分 WebUI 和 Cookie 修复，不能把整个上游点视作已同步。
- 最新 `upstream/main` 不是 HEAD 的祖先。
- 按祖先关系统计，HEAD 独有 **17** 个提交，上游独有 **89** 个提交；去除合并提交后仍是 17 / 89。这不是待移植数量，部分行为已由本地手工实现。
- 相比上次上游检查点新增 **80** 个提交。
- GitHub API 已确认规范仓库为 `https://github.com/Downvid/downvid`，原地址重定向到同一个非 fork 仓库。直接对规范地址执行 `git ls-remote`，HEAD / main 均为 `1dfe63c`，与 `upstream/main` 相同；不是另一层镜像，也没有额外的未同步原始上游。未修改本地 remote 配置。

## 发布状态

- 最新正式 Release 为 [v1.5.0](https://github.com/Downvid/downvid/releases/tag/v1.5.0)，发布时间为北京时间 2026-10-18 14:46。
- `v1.5.0` 是 annotated tag，tag 对象 `f8d46ef`，解引用后提交为 `05a14bb3f2f32b6c4c8a078d3dc8ab924fe1085c`；main 比发布提交多 1 个清理提交。
- Release 包含 24 个附件，既有 Electron 产物，也有 Wails 的 Windows x64、macOS universal、Linux x64 包；四份 `latest*.yml` 均存在。整个 Release 是正式版，但上游 CHANGELOG 将 Wails 产物明确标为新架构预览、手动下载，不能把新架构视为已全面替代 Electron。
- [发布工作流](https://github.com/Downvid/downvid/actions/runs/39104818984)结果为 success。这里只核对发布记录和附件名，未下载或安装二进制验证。
- 本地 `package.json` 为 `1.0.1`，上游为 `1.5.0`；版本序列不同，不据此直接升级本项目版本。

## 产品边界

- 保留 Keep Video / keep.video 品牌、本项目仓库坐标、桌面更新通道和产物命名。
- 保留 Electron / Vue 桌面实现，不将 Go / Wails / Svelte 重构当作普通补丁合并。
- 保留同域 SEO 门户与九语言 `/app/`、匿名会话隔离、服务端队列、授权文件接口和 local / R2 存储。
- 优先核查现有实现适用的下载暂停、进程树、格式、YouTube 回退、运行依赖与容器安全问题。
- 上游品牌、营销、官网、迁仓及 Wails 专属发布改动默认跳过；架构迁移需另行评估。

## 候选批次（实施后的处置）

| 优先级 | 提交 | 子系统 | 分类 | 状态 | 处理建议 |
| --- | --- | --- | --- | --- | --- |
| 高 | `c6aa495` | 下载 / 解析 / 依赖等待 | Manual backport | partially applied | 已移植进程树、格式、缓存、aria2 语言识别、共享检测 Promise；未引入 aria2 托管安装等依赖体系改造 |
| 高 | `76e23eb` | YouTube 回退 | Manual backport | applied | 已在 resolveDependency 后读取路径匹配的真实探测版本；保留 Cookie 生命周期与三轮上限 |
| 高 | `ab4cc9f`（Electron 参数子补丁） | 文件名冲突 | Manual backport | applied | 新视频任务补格式后缀，旧任务和用户已有画质模板不变，续传固定原模板 |
| 高 | `31da940`（移植设计，不是 Go 实现） | 桌面下载历史 | Manual backport | applied | 设计移植到 TypeScript：原子替换、fsync、独立坏库备份，不引入 Go 历史模块或 Wails |
| 高 | `79580c7`、`61d72c7`、`9928ea0` 的相关测试 | 回归 | Manual backport | applied | 依本地契约补回归与变异反证，覆盖 Windows 模拟分支和 POSIX 真进程树；Windows 真机仍待验证 |
| 中 | `569727d` + `ab4cc9f`（运行依赖子补丁） | 依赖探测 / 下载 | Conditional | not applied | 并行探测必须带私有预算修复；zipapp 和 aria2 自动安装需独立验收 |
| 中 | `0cb721e` | 容器构建 | Manual backport | partially applied | 本地已有构建缓存、单文件服务、目标边车及 GHCR；已补清单驱动和 SHA-256，保留非 root，镜像瘦身暂缓 |
| 中 | `ae775a7`、`bc23f37`、`6e76e14` | 更新源 | Conditional | not applied | 先定义本项目可信源与真实 Release 判定，不能直接接受 tag 列表当已发布版本 |
| 中 | `ba97e1d` | npm 依赖 | Conditional | not applied | 独立升级和验证，保留本地 R2 依赖、TypeScript 5.x 与发布版本 |
| 低 | `76b1a6e` | 服务启动测试 | Manual backport | applied | 已补单次请求超时，保留启动日志与退出状态诊断 |
| 已覆盖 | `f09c5ee` | Cookie 错误回退 | Already covered | applied | 本地实现与正反向测试均已存在 |
| 已适配 | `82cb7bd` | WebUI | Manual backport | partially applied | 本地已经独立适配并强化公开服务隔离，不重复导入 |
| 跳过 | `4e52829`、`ad7f139`、`66969e0` | 上游旧测试 / 作者公告 | Skip | skip | 本地不保留对应单文件官网、固定贡献者名单测试或公告功能 |
| 跳过 | `d231e7e` 的 Wails / 镜像命名部分、`26ffe43`、`6f80ae6` | 上游新 CI 回归 | Skip | skip | 本地无 Wails，镜像名已是小写；不引入上游测试桩再修它 |
| 暂缓 | Wails / Svelte / Go core 大批提交 | 架构迁移 | Conditional | not applied | 仅记录方向，不纳入本轮同步建议 |
| 跳过 | 品牌 / 营销 / 迁仓 / 上游官网 | 产品专属 | Skip | skip | 与本地品牌和站点方向冲突 |

## 总体结论

**不直接 merge，也不整批 cherry-pick；优先拆分手工移植现有架构适用的修复。**

80 个新提交的累计差异为 327 个文件、55,880 行新增、2,508 行删除，主要增量来自新架构及其配套测试，而不是 80 个独立缺陷修复。本次核查重点为现有桌面 / Web 共享路径，未完成新 Wails 架构的全面安全、功能和发布审计。

## 第一批核查：下载与解析

- `c6aa495` 不能整颗 cherry-pick：同一提交混有进程树、格式、缓存、依赖 UI 和 aria2 统一管理，后者依赖更早的依赖体系改造。
- 本地 `electron/download/ytdlp.ts` 在 POSIX 平台仍只 `child.kill()`，spawn 未创建独立进程组；应优先手工补齐 yt-dlp / aria2 / ffmpeg 整棵进程树的暂停。Windows 已有先 `taskkill /T /F` 的实现，不能误报为全平台缺失。
- 上游进程树补丁也不能原样照搬：等待逻辑只检查父 PID 存活，父进程先退出、孙进程忽略 SIGTERM 时会提早结束。已用注入的假信号验证这一控制流，未向真实进程发送信号；回归需覆盖整个进程组已停止再允许恢复。
- 本地 `electron/parsers/formats.ts` 使用原始 fps 去重，同清晰度的 29.969 / 29.97 可显示两次；应移植归一化思路。但上游 `normalizeFps()` 用“首个相差不超过 1 的档位”，25 会命中 24，不能原样照搬。
- 本地 `electron/parsers/ytdlp.ts` 缓存只有 TTL、无条数上限，临时 JSON 没有应用退出清理。适合手工补缓存上限和生命周期管理，容器进程退出也要覆盖。
- `c6aa495` 把 YouTube 回退使用的版本临时写成空串，`76e23eb` 才修为惰性读取探测缓存；两者必须一起评估。本地当前仍真实运行 `--version`，并非已经存在这一空串回归，主要可获得减少重复探测的收益。
- `ab4cc9f` 的 Electron 子补丁为文件名增加清晰度维度：本地默认模板只有标题和扩展名，同视频同扩展名不同清晰度有碰撞风险。仅挑参数与测试逻辑，不引入整颗 Wails / Svelte 改造；兼容旧 `.part` 续传路径需要单独设计。
- 本地 `src/stores/download.ts` 已在 `executeDownload()` 的 `finally` 清理进度监听。上游在删除 / 清空入口额外清理可以作为防御措施，但不能仅凭提交说明断言本地已完成、失败或暂停任务一定泄漏。
- 本地 `src/stores/deps.ts` 仍在检查进行中直接 `return`；第二个 `await refresh()` 不会等待第一次完成，适合独立移植共享 in-flight Promise，不必绑定 aria2 自动安装。
- 本地 `electron/download/aria2.ts` 的版本正则只认英文 `aria2 version`，且未固定 locale；可独立移植多语言版本解析和 `LC_ALL=C`，无须先把 aria2 纳入必需依赖。

## 第二批核查：上次评估的候选

- `f09c5ee`：Already covered / applied。本地 `electron/utils/cookies.ts` 已有三类 SQLite 错误识别，`tests/cookie-error.test.ts` 已有坏库正向及非 Cookie 错误反向用例。
- `82cb7bd`：Manual backport / partially applied。本地已手工实现 WebUI 并扩展同域门户、会话隔离、全局队列、私有文件交付与 R2；不重复导入原始服务器。
- `ba97e1d`：Conditional / not applied。Vue、puppeteer-core、Electron、Vite 等版本仍落后该补丁，单独评估依赖升级，保留本地 R2 依赖和脚本，不能替换整个 package.json。

## 第三批核查：历史、依赖与更新源

### 下载历史

`31da940` 只新增 Go 历史模块，没有修旧 Electron 文件。本地 `electron/ipc/history.ts:32` 仍直接覆盖历史 JSON；读取异常被吞掉并返回空列表。因此值得把同目录临时文件、落盘、原子替换及坏库备份的设计移植回 TypeScript，不能因为上游新架构已修就认定本地已覆盖。本地服务器使用独立 Jobs / storage，不用全局桌面历史模型替换它。

### 依赖管理

- `569727d` 引入 Python zipapp、aria2 托管安装、镜像回退、并行探测，涉及边车、清单生成器、IPC、设置和 UI 的联动，不是一处资产 URL 替换。
- **必须配套 `ab4cc9f` 的私有预算修复**：早期并行版本仍共享 `scanDirsLeft` / `scanDeadline` / `probeDeadline`。本地当前串行，不能只拷 goroutine 循环制造数据竞争。
- zipapp 优化有条件：验证运行时真正可执行的解释器及 shebang 一致性，并保留无 Python 的独立包兜底。上游 `HasUsablePython()` 使用无超时的 `exec.Command(...).Output()`，又同时接受 `python3` / `python`，这两个边界都需要修正和测试，不能直接替代现有有预算的探测。
- 镜像下载仍须校验本地清单固定的 SHA-256，不能把公共反代当作版本或哈希权威。新增 aria2 的多平台社区资产要独立审计；仍保持 optional。
- 本地 Docker 已使用 Python zipapp，因此“换 zipapp 的启动收益”主要针对桌面托管副本，不能直接套用上游标题中的耗时数字。

### 更新源

`ae775a7` / `bc23f37` / `6e76e14` 新增 GitHub、jsDelivr、公共反代、Gitee、官网链路与设置。本地可考虑，但需先解决：

1. 所有 URL、仓库坐标、镜像及容器升级命令必须属于本项目；不能把自动更新指向 DownVid。
2. jsDelivr 分支直接取 tags 的最高版本，并未证明存在成功的 Release 和全部更新附件；这与本仓库“tag 不等于发布成功”的约定冲突，应校验发布清单而非只看 tag。
3. 上游这组 Electron 改动主要改变检查兜底，安装包下载仍受原更新通道约束，不能宣传成检查和下载都已完整镜像化。
4. Gitee / 官网端点需确实部署才能启用；新增设置必须迁移并同步 IPC / preload / env 声明、界面词条与回归。

## 第四批核查：容器与架构边界

- `0cb721e` 的可复用价值是从依赖清单取版本和哈希、下载后校验、静态 ffmpeg / ffprobe 以及减少运行时包。本地 `docker/Dockerfile:20` 的 yt-dlp 下载目前只校验能运行、没有 SHA-256 验证，值得单独补齐。
- 本地已经有只编目标边车、服务打包、独立依赖缓存层、`packages: write`、metadata tags、多架构发布和远端 manifest 检查；这些不是本轮待补的新功能。
- 本地服务依赖 AWS SDK 支持 R2；不能为了“无 node_modules”照搬上游 bundler 配置而丢掉运行依赖。
- 上游 Docker 默认 root，本地 `docker/Dockerfile:31` 为 `USER node`，应保留本地最小权限策略。
- 上游 Node WebUI 仍使用共享历史和广播，Go 服务入口也明确定位个人自托管、无多租户。不能用它替换本地会话校验、按 owner 分发、全局队列、私有 `/api/files/:id`、九语言门户与 local / R2。
- Wails 迁移是独立项目：前端框架、Go 工具链、IPC、安装包、自动更新及服务器能力均需重新验收，不能按“体积更小”直接同步；上游发布说明中的大小和性能数字本次未独立复测。

## 合并预演与冲突

运行 `git merge-tree --write-tree --name-only HEAD upstream/main`，退出码为 1，**34 个冲突文件**。命令仅计算候选合并树，没有改动工作区或索引。

冲突文件：

```text
.dockerignore
.github/workflows/ci-linux.yml
.github/workflows/docker.yml
.gitignore
AGENTS.md
CHANGELOG.md
CLAUDE.md
README.md
README.zh-CN.md
docker-compose.yml
docker/Dockerfile
docker/server/electron-shim.ts
docker/server/index.ts
docker/server/security.ts
docker/server/tsconfig.json
docker/web/bridge.ts
docker/web/entry.ts
docker/web/vite.config.ts
docs/faq.md
docs/installation.md
docs/troubleshooting.md
electron-builder.json5
package.json
pnpm-lock.yaml
scripts/gen-release-notes.mjs
scripts/gen-update-manifests.mjs
scripts/gen-website-stats.mjs
scripts/lint-website.mjs
scripts/test-web-server.mjs
shared/app.ts
src/components/AboutView.vue
tests/cookie-error.test.ts
website/README.md
website/index.html
```

文本无冲突也不代表语义兼容：尤其不能让仓库坐标、官网路由、更新产物和服务权限被自动合并覆盖。保留本地自定义提交 `cc68412`、`098ca09`、`c050a0c`、`589c5f0`、`1013d00` 的实现。

## 建议实施批次与验证

1. **下载可靠性**：进程组暂停、清晰度 / 文件名冲突、aria2 多语言识别、依赖 refresh 共用 Promise。复制测试前先按本地契约调整；增加父进程先退出、24 / 25 / 30 / 60 fps、不同画质同标题、已有 `.part` 续传等回归。
2. **解析与持久化**：缓存限额和临时 JSON 生命周期、从探测缓存读取版本、桌面历史原子写入和坏文件保留。必须保留 Cookie 生命周期与三轮上限，并覆盖容器退出清理和损坏历史恢复。
3. **容器供应链与瘦身**：清单驱动依赖下载和 SHA-256 校验，按需替换静态 ffmpeg；分别构建 / 启动 amd64 和 arm64，验证编码能力、非 root 权限、两套静态产物、双会话隔离、文件 Range 和 R2。
4. **可选能力**：并行探测、桌面 zipapp、aria2 托管安装、更新源链路、npm 小版本升级各自独立，不与前三批绑定，更不引入 Wails 迁移。

每批实现完成后按 AGENTS.md 跑完整验证清单，包括类型、逻辑、下载 / 解析 / 加速 / 更新 / 设置 / Web 回归、IPC / 图标 / i18n / 官网 / 文档 / workflow 校验、Go 与打包。涉及边车并行时另跑 `go test -race ./...`；新增测试做变异验证，CI 修改复现非宿主平台语义。

## 实施前的验证快照（不代表最终状态）

- `pnpm test`：20 个测试文件、195 个用例通过。
- `pnpm test:parse:integration`：通过，覆盖版本回退、三轮上限、Cookie 生命周期和运行时缺失。
- `pnpm lint:docs`：通过。
- 用仓库现有 `loader` 在内存中对照本地与上游源码：确认浮点 fps 重复、上游 24 / 25 fps 合并问题、标题模板缺少画质维度，以及父 PID 退出时上游进程树等待提前结束。没有修改生产源码或向真实进程发信号。辅助验证首次缺少测试桩方法，补齐后通过；不属于应用测试失败。
- 测试进程有现有 pnpm 提示：`package.json` 的 `pnpm.onlyBuiltDependencies` 被当前 pnpm 忽略；本轮未改配置。
- 未运行完整构建、真机暂停 / 续传、Windows 原生回归、Docker 镜像构建或发布包安装；没有据此宣称补丁已可发布。未新增或修改生产逻辑、测试用例、工作流、版本号或 remote URL。
- 本轮只有评估文档待提交。新架构的完整代码审计、zipapp 解释器矩阵、第三方镜像可用性与信任、依赖升级兼容性留待对应实施批次验证。

## 授权后实施结果

- 下载进程使用独立 POSIX 进程组；Windows 等待 taskkill。父进程先退出不代表整树已退出，失败不确认暂停。准备阶段、直链暂停、重复恢复、失败删除和并发槽位均有回归。
- 退出和安装更新前等待下载收尾，成功后关闭启动入口，避免队列在安装前补位；安装失败（包括异步 error 事件）恢复入口。Windows 父 PID 已消失但无法确认后代时采用保守报错，不宣称所有 Windows 进程情况都已解决。
- 帧率按最近常用档位的小容差吸附，保留 24/25fps；按分辨率、帧率、编码兼容性、码率排序。仅新视频任务补格式后缀，保留用户模板和旧暂停任务片段；音频、直链与 Web UUID 目录策略不被替换。
- 依赖刷新共享 Promise，force 不被普通刷新吞掉；aria2 支持本地化版本行。解析取消额外版本查询，仅复用执行路径匹配的探测结果，保留 YouTube 回退上限及 Cookie 生命周期。
- 解析缓存限制 100 条 / 30 分钟，私有目录、随机 JSON、0600、LRU 与引用计数；排队及执行中的 Web 任务单独持有引用。解析成功参数随原缓存文件保存，避免同 URL 的不同解析互相覆盖。
- 桌面历史使用同目录随机临时文件、fsync 和原子替换；损坏 JSON 先备份，读取或备份失败不允许覆盖。保留现有去重、迁移备份及 100 条上限。
- Web 队列保留会话隔离、服务端参数约束和全局并发限制；以执行收尾而非状态标签决定删除与释放槽位。并发暂停共用请求，服务关闭等待解析和上传收尾，取消时已完成的远端对象回收。
- 容器从生成清单读取固定 yt-dlp 版本和 zipapp SHA-256，校验后执行。生成器取得官方校验值并经 gofmt 生成原 Go 清单；版本保持 yt-dlp 2026.10.10.233141 / ffmpeg b6.1.1。未引入额外依赖资产或第三方更新镜像。
- CHANGELOG 只写本地 Unreleased，版本保持 1.0.1；AGENTS.md 与 CLAUDE.md 同步契约。没有新增测试脚本入口或工作流，扩展用例仍由现有三平台 CI 入口运行。

## 最终验证证据

| 检查 | 结果 |
| --- | --- |
| pnpm test | 21 个测试文件、201 个用例通过；纯逻辑变异后恢复源码并重跑通过 |
| vue-tsc --noEmit | 通过 |
| test:download:integration / test:parse:integration | 通过，含本地 HTTP / 文件 / Store、真实 POSIX 父孙进程、Windows taskkill 模拟边界、停止失败、历史故障注入及缓存引用 |
| test:acceleration | 内置引擎本地基准通过；外部 yt-dlp / aria2 联动基准未运行，数字不用于真实网站性能承诺 |
| test:updater / test:settings:migration | 15/15、16/16 通过，含安装失败解锁及并发依赖刷新 |
| test:web | 会话、私有文件、受限 RPC、Range、队列与停止保护、解析/上传关闭收尾通过；S3 SDK 上传/读取/删除使用本地协议端点，不等于真实 R2 部署验收 |
| 变异反证 | 缓存/版本、停止/历史/Store、依赖刷新、更新安装、Web 队列/关闭、清单哈希、格式/模板/aria2 都验证过坏实现能使测试失败 |
| lint:ipc / lint:icons / lint:i18n / lint:website / lint:docs / lint:workflows | 通过；官网仍为 117 个九语言页面，i18n 中英各 290 词条 |
| deps:manifest:check | 与上游一致，含 zipapp 校验值 |
| Go gofmt / vet / go test -shuffle=on | 通过；格式无差异 |
| 五平台边车交叉编译 | Windows x64、Linux x64/arm64、macOS x64/arm64 通过；不等于五平台真机运行 |
| pnpm build:web / 服务 esbuild 打包 | 通过，仍是九语言门户 + Vue WebUI + Node 服务 |
| pnpm build | 通过，生成 macOS arm64/x64 的 ZIP 和 DMG；未安装或发布这些产物 |
| test:package | 指定本次 release/1.0.1/mac-arm64 与 release/1.0.1/mac，分别 9/9 通过。默认自动选择器曾误选遗留的较高版本目录而报版本不一致，未改版本号规避 |
| git diff --check | 通过 |

### 浏览器验证

- 使用 ego-browser 操作本地真实构建服务；专用 Browser 插件未提供，按仓库技能优先使用已有 ego-browser，没有安装新浏览器依赖。
- 验证流程：英文在线页加载 → 在真实 Store 中注入仅本页生效的假下载/暂停接口 → 点击暂停 → 显示暂停失败 alert、任务保持 downloading → 删除被阻止 → 再次暂停成功 → 中文在线页加载。
- 桌面 1440×1000 和手机 390×844 的 DOM/布局测量均无横向溢出；页面非空、品牌正确、无框架错误遮罩，测试期间捕获的 error/warn 与未处理异常为空。模拟故障不等于真实站点下载验收。
- 截图接口 Page.captureScreenshot 连续超时（高层方法及低层诊断均失败），因此没有可交付截图，不能宣称完成像素级视觉检查。

### 品牌与产品隔离

- 对 49 个受保护文件逐字节比较 HEAD：图片/Logo、shared/app.ts、package.json、electron-builder.json5、官网源文件、README、工作流及容器发布配置均未改变。
- 展示名称 Keep Video、productName KeepVideo、appId app.framekeep.desktop、发布仓库 oiov/download、域名 keep.video、版本 1.0.1 保持不变。
- 保留 Framekeep 历史用户数据标识、downvid 技术路径和合法上游署名；没有做破坏兼容性或抹除许可证的全局替换。
- 没有引入上游 Logo/名称/官网、更新镜像源或 Wails/Svelte 架构。Web 仍保留匿名会话、服务端队列、授权 /api/files、九语言 SEO 和 local/R2。

### 未完成或既有问题

- Windows 原生运行脚本在本机明确跳过；仍需 Windows CI / 真机验证。macOS 已跑真实父孙进程，但没有拿真实视频站点做跨平台下载、转码与续传验收。
- Docker 守护进程不可用，未执行 amd64/arm64 镜像构建与启动；非 root、文件持久化、ffmpeg 编码能力及实际 R2 部署需镜像环境复核。
- 额外尝试独立 Web tsc 检查发现既有 NodeNext 无扩展名导入问题。使用与打包方式一致的 Bundler 解析后仍有 6 项 Electron shim/类型问题；在 HEAD 临时快照复现并与当前诊断比较，没有新增诊断。本轮未扩大范围重写兼容层；不能把打包通过写成独立服务类型检查已通过。
- 现有 pnpm.onlyBuiltDependencies 配置提示和混合静态/动态 import 构建提示仍在，未趁机改包管理配置。
- 实施验证结束时改动尚未提交；随后用户授权提交、推送并跟踪该提交的 Actions。提交采用选择性移植，不创建 PR 或发布 tag，不手动触发桌面 Release；现有 main 工作流会构建并发布容器镜像。后续同步仍需按本报告的候选状态判断，不能把整个 upstream/main 当成已合并祖先。
