# Framekeep 官网改版与 SEO

## 产品与页面

网站品牌为 Framekeep，独立域名待定。网站承接搜索访问，引导进入桌面下载流程。不是在线解析工具。客户端当前保留上游名称与界面，独立品牌安装包未发布，下载中心明确区分上游版本。

首页、下载中心、指南目录，以及首次使用、音频、字幕、故障排查四篇指南，各有完整中英文版本，共 14 页。页面各自覆盖独立意图；尚无关键词搜索量或难度数据，不将候选词称为已验证机会。

| 页面 | 搜索意图 |
| --- | --- |
| / | Framekeep、桌面视频下载器 |
| /download/ | macOS / Windows / Linux 安装包 |
| /guides/getting-started/ | 首次安装与运行依赖 |
| /guides/audio/ | 从视频保存 MP3 音频 |
| /guides/subtitles/ | 单独保存 SRT 字幕 |
| /guides/troubleshooting/ | 解析、登录、Cookie、合并失败 |

## 采用的方法

- [marketingskills / seo-audit](https://github.com/coreyhaines31/marketingskills/blob/main/skills/seo-audit/SKILL.md)：先验证可抓取与索引，再处理标题、页面意图和内容；同时检查原始 HTML 与浏览器。
- [marketingskills / site-architecture](https://github.com/coreyhaines31/marketingskills/blob/main/skills/site-architecture/SKILL.md)：目录、文章、下载入口分工，使用上下文内链和面包屑。
- [marketingskills / copywriting](https://github.com/coreyhaines31/marketingskills/blob/main/skills/copywriting/SKILL.md)：明确用户收益、使用场景与下一步；不虚构下载量或评论。
- [marketingskills / schema](https://github.com/coreyhaines31/marketingskills/blob/main/skills/schema/SKILL.md)：JSON-LD 只描述实际内容；WebSite、SoftwareApplication 和 BreadcrumbList，不添加虚构评分。
- [哥飞经验汇编](https://github.com/Jayin/gefei-seo-cookbook)：从具体长尾需求开始，优先完善少量真实有用页面。KGR、关键词密度等经验值不作为排名保证。本库是第三方整理，没有复制原公众号文章。
- 用户的 nb-gen 项目：复用独立语言 URL、明确公开页面、原始 HTML、生产域名和预览收录隔离的方法；视觉参考其大画幅摄影、排版、章节节奏。

## 素材

已复用 nb-gen 的 scripts/nbility-image.py 工作流，当前项目入口是 scripts/generate-website-art.py。通过 NBILITY_IMAGE_API_KEY 读取凭据，不写入代码和素材；图片下载不携带 API 密钥。website/art-direction.json 保存 Framekeep 专属提示词。

2026-10-15 修正服务配置后，专属素材已成功生成。用户不喜欢电影风景方向，因此最终采用浅色玻璃画框与编辑式静物，搭配暖白、杏橙和银色。全部通过 Nbility gpt-image-2-5-sunburst 生成，压缩为本地 WebP。网站已移除之前临时复用的 nb-gen 图片。

| 文件 | 用途 |
| --- | --- |
| hero-frame-light.webp | 浅色悬浮画框首屏 |
| video-frame-light.webp | 画框与播放符号 |
| audio-frame-light.webp | 浅色耳机静物 |

生成提示词保存在 website/art-direction.json。凭据与任务结果不提交。三款 Logo 是独立矢量设计，保存在 website/assets/brand，当前采用 frame-play.svg，另外两款为 folded-film.svg 与 keep-mark.svg；favicon 与导航标识保持一致。

## 收录与验证

不含正式域名的构建输出 noindex、空 sitemap，不输出虚构 canonical。配置 SITE_URL 后正式构建生成相互对应的语言标注及完整 sitemap；Vercel preview 或 SITE_PREVIEW=1 保持 noindex。站点有真正的 404，不用首页兜底未知路径。

pnpm lint:website 已复用原有三个平台 CI 的入口，检查 14 页独立标题与描述、资源和链接、JSON-LD、语言回链、分享图尺寸、生产/预览模式及非法域名。浏览器验证覆盖桌面、390px 和 320px；页面在无 JavaScript 时可导航。

上线时配置正式域名，核对实际安装包状态，提交 sitemap 到 Search Console，并检查中文首页、英文页与指南的实时抓取。后续依据曝光、点击和下载转化迭代。

## 域名候选（未核实注册状态）

优先 framekeep.app；其次 getframekeep.com、framekeep.io、framekeep.co。名称与域名是建议，注册可用性及名称冲突需确定品牌前另行查询。
