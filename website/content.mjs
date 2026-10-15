// 每篇文章有独立搜索意图和完整双语正文。
export const guides = [
  {
    slug: 'getting-started', category: ['开始使用', 'GETTING STARTED'],
    title: ['第一次使用 Keep Video：从安装到下载', 'Your first download with Keep Video'],
    description: ['了解 Keep Video 桌面视频下载器的安装、运行依赖、链接解析和文件保存步骤，适用于 macOS、Windows 和 Linux。', 'Install Keep Video, prepare its runtime tools, choose a format and save your first video on macOS, Windows or Linux.'],
    intro: ['Keep Video 在你的电脑上运行。网页提供介绍与下载入口，视频解析、文件保存和格式转换由桌面客户端完成。', 'Keep Video runs on your computer. This website provides information and download links; the desktop app handles parsing, saving and conversion.'],
    sections: [
      [['1. 选择适合电脑的安装包', '1. Choose the right installer'], ['macOS 用户在“关于本机”确认是 Apple 芯片还是 Intel，再选 ARM64 或 x64 的 DMG。Windows 使用 x64 安装包。Linux 根据发行版选择 AppImage 或 DEB，以发布页面实际提供的文件为准。', 'On macOS, check About This Mac for Apple silicon or Intel, then choose the ARM64 or x64 DMG. Use the x64 installer on Windows. On Linux, choose a compatible AppImage or DEB from the files offered in the release.']],
      [['2. 准备运行依赖', '2. Prepare the runtime tools'], ['首次打开时，应用会检查 yt-dlp 和 FFmpeg。缺失时按提示下载安装，或到“设置 → 运行依赖”查看状态。YouTube 还可能需要 Node.js 22+ 或 Deno 2.3+，目前需要自行安装。', 'At first launch, the app checks for yt-dlp and FFmpeg. Install missing tools from the prompt or inspect them in Settings → Runtime dependencies. YouTube may also require Node.js 22+ or Deno 2.3+, installed separately.']],
      [['3. 粘贴视频页面链接', '3. Paste the video page URL'], ['复制你有权保存的视频链接，在应用中粘贴并解析。若分享文本混有说明文字而无法识别，单独复制完整 URL。解析后核对标题和可用格式。', 'Paste and parse the URL of a video you have permission to save. If a share message contains extra text that cannot be recognized, paste only the full URL. Check the title and available formats.']],
      [['4. 选择格式并保存', '4. Choose a format and save'], ['选择视频、仅音频或仅字幕，设置目录后开始下载。高画质视频可能先分别下载音视频，再由 FFmpeg 合并；合并时请保持应用运行。完成后打开文件确认内容与音轨。', 'Choose video, audio only or subtitles only and set an output folder. Higher-quality video may download separate streams before FFmpeg merges them. Keep the app open during merging, then check the saved file and audio track.']],
    ], related: ['audio', 'subtitles', 'troubleshooting'],
  },
  {
    slug: 'audio', category: ['音频工作流', 'AUDIO WORKFLOW'],
    title: ['如何从视频中保存 MP3 音频', 'How to save audio from a video as MP3'],
    description: ['使用 Keep Video 的仅音频模式保存 MP3，了解 FFmpeg 转换、音质限制，以及解析或转换失败时的检查方法。', 'Save an MP3 with audio-only mode in Keep Video. Understand FFmpeg conversion, source quality and what to check if conversion fails.'],
    intro: ['做听力练习、整理自己的访谈或离线收听已获授权的内容时，可以只保存音频，减少不需要的视频文件。', 'For listening practice, your own interviews or licensed offline listening, keep the sound without an unnecessary video file.'],
    sections: [
      [['选择仅音频模式', 'Choose audio-only mode'], ['在客户端解析链接，核对标题，再选择“仅音频（MP3）”。此功能提取来源音频，不会分离人声与背景音乐，也不会提升原始录音质量。', 'Parse the URL, check the title and choose Audio only (MP3). This extracts source audio; it does not separate vocals from music or improve the original recording.']],
      [['准备 FFmpeg', 'Prepare FFmpeg'], ['在“设置 → 运行依赖”确认 FFmpeg 可用。来源音频可能是 AAC、Opus 等格式，保存成 MP3 需要转码。网络下载结束后仍在处理，通常是转换尚未完成。', 'Confirm FFmpeg is available in Settings → Runtime dependencies. Sources may provide AAC, Opus or other formats, so saving as MP3 needs conversion. Processing can continue after the network download finishes.']],
      [['检查音质和内容', 'Check quality and content'], ['用播放器试听开头、中间和结尾，确认没有缺段或错误音轨。提高输出码率不能找回来源丢失的细节；更好的合法来源通常更有效。', 'Listen to the beginning, middle and end to check for missing sections or the wrong track. A higher output bitrate cannot recover detail missing from the source; a better authorized source is more useful.']],
      [['转换失败时', 'If conversion fails'], ['检查磁盘空间、目录权限和 FFmpeg 状态。若失败发生在解析阶段，更新 yt-dlp，并参考故障指南检查登录状态或网站变化。', 'Check free disk space, folder permissions and FFmpeg. If parsing failed instead, update yt-dlp and use the troubleshooting guide to investigate login requirements or site changes.']],
    ], related: ['getting-started', 'troubleshooting'],
  },
  {
    slug: 'subtitles', category: ['字幕工作流', 'SUBTITLE WORKFLOW'],
    title: ['如何单独下载视频字幕（SRT）', 'How to download video subtitles as SRT'],
    description: ['使用 Keep Video 保存来源已有的字幕，了解字幕模式、语言可用性、SRT 文件与视频同步，以及没有字幕时的限制。', 'Save available subtitle tracks with Keep Video. Learn about subtitle mode, language availability, SRT timing and missing captions.'],
    intro: ['只需要阅读文本或整理学习资料时，可以单独保存字幕。字幕模式使用来源已有的字幕轨道，不会把没有字幕的视频自动转写成文字。', 'Save subtitles separately for reading or study. Subtitle mode uses tracks already available from the source; it does not transcribe videos without captions.'],
    sections: [
      [['选择仅字幕模式', 'Choose subtitles-only mode'], ['在客户端选择仅字幕（SRT）模式，粘贴并解析视频链接。仅字幕模式不要求 FFmpeg，但仍需要可用的 yt-dlp。可用语言取决于具体视频。', 'Choose Subtitles only (SRT), then paste and parse the URL. This mode needs a working yt-dlp installation but does not require FFmpeg. Available languages depend on the video.']],
      [['理解字幕来源', 'Understand caption sources'], ['是否有字幕以及能否下载，取决于网站和视频。自动字幕可能含有识别错误，专有名词、数字和多人对话需要核对。没有列出的语言不会自动生成。', 'Availability depends on the website and video. Automatic captions can contain errors, especially in names, numbers and overlapping speech. Missing languages are not automatically generated.']],
      [['让字幕与视频对应', 'Match subtitles to the video'], ['SRT 包含时间码与文本。把字幕与对应视频放在同一目录，按播放器要求加载；相同的文件名主体有助于部分播放器自动识别。剪辑后的视频可能需要调整字幕时间。', 'SRT contains timecodes and text. Keep it beside the matching video and load it in your player. Matching base filenames help some players detect subtitles. Edited videos may need timing adjustments.']],
      [['找不到字幕时', 'When no captions are found'], ['先在原网站确认字幕存在，再检查登录状态并更新引擎。来源没有可下载轨道时，需要另行使用转写工具，重复下载视频不会增加字幕。', 'Confirm captions exist on the original site, then check your login state and update the engine. If the source exposes no downloadable track, use a separate transcription tool. Downloading the video again does not create captions.']],
    ], related: ['getting-started', 'troubleshooting'],
  },
  {
    slug: 'troubleshooting', category: ['故障排查', 'TROUBLESHOOTING'],
    title: ['视频下载失败？按阶段定位原因', 'Video download failed? Find the failing stage'],
    description: ['排查 Keep Video 链接解析、登录验证、B 站 412、Cookie 读取、FFmpeg 合并与依赖安装问题，按阶段找到下一步。', 'Troubleshoot Keep Video parsing, login checks, Bilibili 412 responses, cookie access and FFmpeg merging by finding the failing stage.'],
    intro: ['先分清问题发生在解析、下载还是合并阶段。不同阶段依赖不同工具，一直重复点击下载往往不能解决根因。', 'First identify whether parsing, downloading or merging failed. Each stage depends on different tools; repeatedly starting the task rarely fixes its cause.'],
    sections: [
      [['链接没有解析成功', 'The URL has not parsed'], ['使用完整的视频页面 URL，去掉分享文案。确认内容仍存在且你的账号可访问，再检查 yt-dlp 版本。网站改版可能导致暂时不支持，支持列表不保证每个视频始终可下载。', 'Use the complete video-page URL without share text. Confirm the content exists and your account can access it, then check yt-dlp. Website changes can temporarily break support; a supported site does not guarantee every video works.']],
      [['登录验证或 B 站 412', 'Login checks or Bilibili 412'], ['先在浏览器正常登录并确认可播放，再在设置中读取该浏览器登录状态，或导入自己的 cookies.txt。412 可能与请求校验或访问限制有关；暂停重试、检查更新，仍失败时报告脱敏后的错误类别。不要分享 Cookie 文件。', 'Sign in normally in your browser and confirm playback, then read that browser’s login state or import your own cookies.txt. A 412 response may involve request checks or access restrictions. Pause retries, check updates and report a sanitized error category if needed. Never share cookie files.']],
      [['Cookie 读取报错', 'Cookie access errors'], ['浏览器数据库格式、锁定状态和系统权限都可能影响读取。选择实际登录的浏览器，按提示处理权限；必要时导入自己导出的文件。登录状态过期后需重新获取。', 'Browser database formats, locks and permissions can affect access. Select the browser where you are signed in and follow the permission guidance. If needed, import your own exported cookies and refresh them when they expire.']],
      [['下载中断或合并失败', 'Interrupted downloads or merging errors'], ['检查网络、磁盘空间和目录权限，再使用队列重试。合并失败则检查 FFmpeg。当前队列不支持跨应用重启恢复，请先保留错误信息，不要把重启当作保证续传的操作。', 'Check your connection, disk space and folder permissions, then retry from the queue. Check FFmpeg for merging errors. The current queue does not restore across restarts, so preserve error details before closing the app.']],
    ], related: ['getting-started', 'audio', 'subtitles'],
  },
]
