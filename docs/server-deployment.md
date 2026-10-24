# Keep Video 单站点部署

门户、九语言 SEO 页面和 /app/ 在线工具由同一个容器提供，替代原 Worker 部署。桌面入口保留在 /download/。

## 启动

1. 使用「Keep Video 镜像」工作流；main 发布 latest，版本 tag 发布版本标签。首次发布后将 GitHub Package 设为公开，或在服务器登录 GHCR。
2. 将 docker-compose.yml 和 docker/.env.example 复制到服务器同一目录，后者命名为 .env。
3. 设置 SITE_URL=https://keep.video，然后执行 docker compose pull 和 docker compose up -d。
4. HTTPS 反向代理转发到 127.0.0.1:6080，支持 WebSocket Upgrade，并将下载响应超时设置为足够长。应用只暴露回环端口。Caddy 可使用 keep.video 站点块内的 reverse_proxy 127.0.0.1:6080。
5. 确认首页、/zh/、/app/、/healthz 正常后，移除旧 Worker 自定义域绑定，再切换域名到服务器。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| STORAGE_DRIVER | local | local 或 r2 |
| DOWNVID_DOWNLOADS | 容器 /data/downloads | 工作及本地文件目录 |
| DOWNVID_DATA_DIR | 容器 /data/userdata | 持久化会话与任务清单 |
| R2_ENDPOINT | 空 | R2 S3 API HTTPS 地址 |
| R2_BUCKET | 空 | 私有桶名 |
| R2_ACCESS_KEY_ID | 空 | 桶范围 S3 密钥 ID |
| R2_SECRET_ACCESS_KEY | 空 | 桶范围 S3 密钥 |
| FILE_TTL_HOURS | 24 | 从创建任务起算的保存时长 |
| WEB_CONCURRENCY | 3 | 全局并发下载上限 |
| WEB_MAX_QUEUED | 30 | 全局运行和等待任务上限 |
| WEB_SESSION_TASKS | 10 | 单会话保留任务上限 |
| MAX_FILE_MB | 2048 | 单任务大小上限 |
| TASK_TIMEOUT_MINUTES | 60 | 下载任务超时 |
| ANALYTICS_ENABLED | 1 | 设为 0 关闭本地事件记录，不影响下载 |
| ANALYTICS_ENVIRONMENT | development | 生产显式设为 production；测试设为 test |
| ANALYTICS_RETENTION_DAYS | 30 | 1–30 个 UTC 日分区（含当日），与文件 TTL 独立 |
| ANALYTICS_MAX_DAILY_MB | 16 | 单日事件文件上限，超过后丢弃统计而非阻塞业务 |

local 指服务器磁盘；访客点击保存后由浏览器保存到设备下载目录。网页不能无提示写入访客任意本地目录。

R2 模式仍先本地下载合并，上传成功后删除工作文件。桶无需公开或配置浏览器 CORS，本站按 HttpOnly 会话授权后流式交付。R2 仍需持久化任务数据卷。密钥不得放进 VITE_* 或镜像构建参数。

切换存储驱动前先等待旧任务过期清理，或保留原实例处理旧任务。一个实例使用一种存储驱动。桶建议配置生命周期规则作为清理兜底，期限不短于 FILE_TTL_HOURS；同时配置失败分片上传清理。

## 更新与回滚

生产建议在 Compose 的 image 中固定版本或 digest。更新执行 docker compose pull 和 docker compose up -d；回滚恢复上一镜像版本再重建。不要执行 docker compose down -v，否则会删除任务和会话。

## 使用边界

在线模式仅支持公开 HTTP/HTTPS 链接，不接受访客 Cookie、服务器目录或代理配置；需要登录态的来源使用桌面版。关闭页面后服务器继续任务，同一浏览器可在下载历史查看结果。清除 Cookie 后无法访问旧任务。

服务重启将执行中任务标记失败，可重新解析；已完成文件保留到过期。下载器经过受限公网代理，部署方还应设置容器出站网络策略。磁盘按并发与文件上限预留空间。

上游来源为 yxxbc/downvid 的 WebUI 架构和下载引擎；Keep Video 独立运营，不是上游官方托管服务。

在线工具默认使用英文，中文入口 /zh/app/；九语言地址与门户一致。公开在线页可索引并列入 sitemap，用户任务及文件仍由会话隔离，/api/ 保持 noindex。旧 /zh-cn/ 地址永久跳转到 /zh/。

## 无数据库统计

P0 使用持久化卷中的 `userdata/analytics/` JSONL 事件与离线报表，不新增数据库或管理接口。指标定义、隐私边界、导出和回退见 [下载漏斗统计](analytics.md)。容器更新后需显式设置 `ANALYTICS_ENVIRONMENT=production` 才会进入默认生产报表；本地默认 development。
