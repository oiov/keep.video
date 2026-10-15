export const platforms = [
  {
    "slug": "youtube-video-downloader",
    "name": "YouTube",
    "category": [
      "YouTube 下载指南",
      "YOUTUBE GUIDE"
    ],
    "title": [
      "YouTube 视频下载器：画质、音频与字幕",
      "YouTube Video Downloader for Desktop"
    ],
    "description": [
      "保存有权下载的 YouTube 视频、音频和字幕。了解 Keep Video 的画质选择、FFmpeg 合并与 JavaScript 运行时配置。",
      "Download permitted YouTube videos, audio and subtitles with Keep Video. Learn about format selection, FFmpeg merging and JavaScript runtime setup."
    ],
    "intro": [
      "Keep Video 通过 yt-dlp 提供 YouTube 视频下载支持，在 macOS、Windows 和 Linux 本地运行。此网页介绍操作方法，实际解析和保存需要安装桌面应用。",
      "Keep Video supports YouTube video downloading through yt-dlp on macOS, Windows and Linux. This page explains the workflow; install the desktop app to parse links and save files."
    ],
    "sections": [
      [
        [
          "安装并准备工具",
          "Install and prepare the tools"
        ],
        [
          "下载适合系统的 Keep Video，在设置中确认 yt-dlp 与 FFmpeg 可用。只保存你拥有或已获授权的内容。",
          "Install Keep Video for your operating system and check yt-dlp and FFmpeg in Settings. Save content you own or have permission to download."
        ]
      ],
      [
        [
          "YouTube 视频与 Shorts",
          "YouTube videos and Shorts"
        ],
        [
          "复制完整 watch 或 Shorts 页面链接，粘贴到客户端解析。先确认标题，再从实际返回的格式中选择；直播与播放列表不等于单条视频下载，具体可用性以解析结果为准。",
          "Copy the full watch or Shorts URL into the app. Confirm the title and choose a returned format. Live streams and playlists differ from individual videos; availability depends on the parsed source."
        ]
      ],
      [
        [
          "高画质为什么要合并",
          "Why higher quality needs merging"
        ],
        [
          "YouTube 的高画质视频常将音视频分开提供。Keep Video 使用 FFmpeg 合并，来源没有提供的清晰度无法凭空生成；可用字幕也取决于视频是否提供字幕轨。",
          "YouTube often serves higher-quality video and audio separately. Keep Video uses FFmpeg to merge them. It cannot create resolutions absent from the source, and subtitles require an available caption track."
        ]
      ],
      [
        [
          "解析与登录问题",
          "Runtime and login issues"
        ],
        [
          "YouTube 解析可能需要 Node.js 22+ 或 Deno 2.3+。先更新 yt-dlp 并检查运行时；年龄限制或需要登录的内容仍要求你拥有正常访问权限。",
          "YouTube extraction may require Node.js 22+ or Deno 2.3+. Update yt-dlp and check your runtime first. Age-restricted or sign-in content still requires legitimate access."
        ]
      ],
      [
        [
          "解析失败时怎么做",
          "If extraction fails"
        ],
        [
          "确认浏览器能正常访问链接，更新 yt-dlp，再按故障指南检查登录状态、网络与运行依赖。平台规则可能变化，支持不代表每条视频始终可用。仍有问题可发邮件到 support@keep.video，附系统、版本与脱敏错误信息。",
          "Confirm the link works in a browser, update yt-dlp, then check login state, network and runtime tools using the troubleshooting guide. Platforms change; support does not mean every video always works. Email support@keep.video with your operating system, app version and a redacted error message."
        ]
      ]
    ],
    "related": [
      "getting-started",
      "troubleshooting"
    ]
  },
  {
    "slug": "bilibili-video-downloader",
    "name": "Bilibili",
    "category": [
      "Bilibili 下载指南",
      "BILIBILI GUIDE"
    ],
    "title": [
      "Bilibili 视频下载器：保存 B 站视频与音频",
      "Bilibili Video Downloader for Desktop"
    ],
    "description": [
      "使用 Keep Video 在电脑保存可访问的 Bilibili 视频与音频。了解 BV 链接、分 P 选择、登录画质和音视频合并。",
      "Save accessible Bilibili videos and audio on your computer with Keep Video. Learn about BV links, multi-part videos, login-dependent quality and merging."
    ],
    "intro": [
      "Keep Video 通过 yt-dlp 提供 Bilibili 视频下载支持，在 macOS、Windows 和 Linux 本地运行。此网页介绍操作方法，实际解析和保存需要安装桌面应用。",
      "Keep Video supports Bilibili video downloading through yt-dlp on macOS, Windows and Linux. This page explains the workflow; install the desktop app to parse links and save files."
    ],
    "sections": [
      [
        [
          "安装并准备工具",
          "Install and prepare the tools"
        ],
        [
          "下载适合系统的 Keep Video，在设置中确认 yt-dlp 与 FFmpeg 可用。只保存你拥有或已获授权的内容。",
          "Install Keep Video for your operating system and check yt-dlp and FFmpeg in Settings. Save content you own or have permission to download."
        ]
      ],
      [
        [
          "使用完整 BV 链接",
          "Use the full BV video URL"
        ],
        [
          "建议使用 bilibili.com/video/BV 开头的完整视频页链接。分享短链可能需要跳转；解析异常时在浏览器打开后复制最终链接。",
          "Use the full bilibili.com/video/BV video page URL. Shared short links may redirect; open them in your browser and copy the final URL if parsing fails."
        ]
      ],
      [
        [
          "多分 P 与清晰度",
          "Multi-part videos and quality"
        ],
        [
          "多分 P 视频请核对当前链接指向的分集，保存后确认内容。较高画质可能依赖登录或会员权限，客户端只显示当前可访问的格式，不会解锁付费内容。",
          "For multi-part videos, check which part your URL selects and verify the saved file. Higher quality may require login or membership; the app lists accessible formats and does not unlock paid content."
        ]
      ],
      [
        [
          "合并与音频",
          "Merging and audio"
        ],
        [
          "部分 B 站来源使用独立音视频流，需要 FFmpeg 合并。仅音频模式可用于自己发布的课程或已获授权的访谈；下载后确认音轨完整。",
          "Some Bilibili sources use separate video and audio streams that require FFmpeg. Audio-only mode is useful for your own lessons or licensed interviews; check the resulting audio track."
        ]
      ],
      [
        [
          "解析失败时怎么做",
          "If extraction fails"
        ],
        [
          "确认浏览器能正常访问链接，更新 yt-dlp，再按故障指南检查登录状态、网络与运行依赖。平台规则可能变化，支持不代表每条视频始终可用。仍有问题可发邮件到 support@keep.video，附系统、版本与脱敏错误信息。",
          "Confirm the link works in a browser, update yt-dlp, then check login state, network and runtime tools using the troubleshooting guide. Platforms change; support does not mean every video always works. Email support@keep.video with your operating system, app version and a redacted error message."
        ]
      ]
    ],
    "related": [
      "getting-started",
      "troubleshooting"
    ]
  },
  {
    "slug": "tiktok-video-downloader",
    "name": "TikTok",
    "category": [
      "TikTok 下载指南",
      "TIKTOK GUIDE"
    ],
    "title": [
      "TikTok 视频下载器：在电脑保存视频",
      "TikTok Video Downloader for Desktop"
    ],
    "description": [
      "使用 Keep Video 保存可访问且已获授权的 TikTok 视频。了解分享链接、短链解析、格式选择与下载失败排查。",
      "Download accessible, permitted TikTok videos with Keep Video for Windows, macOS and Linux. Learn about shared links, formats and extraction troubleshooting."
    ],
    "intro": [
      "Keep Video 通过 yt-dlp 提供 TikTok 视频下载支持，在 macOS、Windows 和 Linux 本地运行。此网页介绍操作方法，实际解析和保存需要安装桌面应用。",
      "Keep Video supports TikTok video downloading through yt-dlp on macOS, Windows and Linux. This page explains the workflow; install the desktop app to parse links and save files."
    ],
    "sections": [
      [
        [
          "安装并准备工具",
          "Install and prepare the tools"
        ],
        [
          "下载适合系统的 Keep Video，在设置中确认 yt-dlp 与 FFmpeg 可用。只保存你拥有或已获授权的内容。",
          "Install Keep Video for your operating system and check yt-dlp and FFmpeg in Settings. Save content you own or have permission to download."
        ]
      ],
      [
        [
          "从分享链接开始",
          "Start with a shared video link"
        ],
        [
          "复制单条 TikTok 视频的分享链接，尽量只保留 URL。短链接无法解析时，在浏览器打开并复制完整视频地址，再粘贴到客户端。",
          "Copy the share URL for an individual TikTok video, without surrounding text. If a short URL fails, open it in a browser and paste the complete video address into the app."
        ]
      ],
      [
        [
          "保存来源提供的版本",
          "Save the version supplied by the source"
        ],
        [
          "解析后核对作者、标题与格式。文件是否带水印取决于来源提供的版本，Keep Video 不承诺去水印，也不会提升来源分辨率。",
          "Check the creator, title and formats after parsing. Watermarks depend on the version supplied by the source. Keep Video does not promise watermark removal or improved source resolution."
        ]
      ],
      [
        [
          "区域和可见性限制",
          "Regional and visibility limits"
        ],
        [
          "地区、登录状态或作者可见性设置可能影响解析。先在正常浏览器确认视频可播放，再检查 yt-dlp 更新；私人或已删除的视频不保证可下载。",
          "Region, login state and creator visibility settings can affect extraction. Confirm playback in your normal browser and check yt-dlp updates. Private or deleted videos are not guaranteed to download."
        ]
      ],
      [
        [
          "解析失败时怎么做",
          "If extraction fails"
        ],
        [
          "确认浏览器能正常访问链接，更新 yt-dlp，再按故障指南检查登录状态、网络与运行依赖。平台规则可能变化，支持不代表每条视频始终可用。仍有问题可发邮件到 support@keep.video，附系统、版本与脱敏错误信息。",
          "Confirm the link works in a browser, update yt-dlp, then check login state, network and runtime tools using the troubleshooting guide. Platforms change; support does not mean every video always works. Email support@keep.video with your operating system, app version and a redacted error message."
        ]
      ]
    ],
    "related": [
      "getting-started",
      "troubleshooting"
    ]
  },
  {
    "slug": "instagram-video-downloader",
    "name": "Instagram",
    "category": [
      "Instagram 下载指南",
      "INSTAGRAM GUIDE"
    ],
    "title": [
      "Instagram 视频下载器：保存视频与 Reels",
      "Instagram Video Download — Videos & Reels on Desktop"
    ],
    "description": [
      "在电脑使用 Keep Video 下载可访问的 Instagram 视频与 Reels。查看链接获取、登录要求、格式选择与常见解析问题。",
      "Instagram video download on Windows, macOS and Linux with Keep Video. Save permitted videos and Reels; learn about URLs, login requirements and formats."
    ],
    "intro": [
      "Keep Video 通过 yt-dlp 提供 Instagram 视频下载支持，在 macOS、Windows 和 Linux 本地运行。此网页介绍操作方法，实际解析和保存需要安装桌面应用。",
      "Keep Video supports Instagram video downloading through yt-dlp on macOS, Windows and Linux. This page explains the workflow; install the desktop app to parse links and save files."
    ],
    "sections": [
      [
        [
          "安装并准备工具",
          "Install and prepare the tools"
        ],
        [
          "下载适合系统的 Keep Video，在设置中确认 yt-dlp 与 FFmpeg 可用。只保存你拥有或已获授权的内容。",
          "Install Keep Video for your operating system and check yt-dlp and FFmpeg in Settings. Save content you own or have permission to download."
        ]
      ],
      [
        [
          "复制视频或 Reels 的链接",
          "Copy a video or Reel URL"
        ],
        [
          "打开单条 Instagram 视频或 Reel，通过分享菜单复制链接。将 instagram.com/reel/ 或视频帖子的完整 URL 粘贴到客户端，解析后检查内容。图片帖子不属于视频下载。",
          "Open an individual Instagram video or Reel and copy its link from the share menu. Paste the complete instagram.com/reel/ or video-post URL into the app and check the parsed content. Photo posts are not video downloads."
        ]
      ],
      [
        [
          "登录与私人账号",
          "Login and private accounts"
        ],
        [
          "Instagram 可能要求登录，即使浏览器中可以播放，下载器仍可能需要同一账号的 Cookie。仅对你有权访问和保存的内容使用登录状态；无法绕过私人账号权限。不要把 Cookie 发送给支持邮箱。",
          "Instagram may require sign-in. Even when playback works in a browser, the downloader may need cookies from the same account. Use your session only for content you may access and save; private-account permissions cannot be bypassed. Never email your cookies to support."
        ]
      ],
      [
        [
          "选择视频格式并检查结果",
          "Choose a format and verify the file"
        ],
        [
          "解析成功后选择来源提供的视频格式与目录，完成后用播放器确认画面和音轨。Instagram 可能只返回压缩后的版本；不能保证原始上传画质或所有帖子均可下载。",
          "Choose an available video format and output folder. After saving, verify the picture and audio in a player. Instagram may expose only a compressed version; original upload quality and support for every post are not guaranteed."
        ]
      ],
      [
        [
          "解析失败时怎么做",
          "If extraction fails"
        ],
        [
          "确认浏览器能正常访问链接，更新 yt-dlp，再按故障指南检查登录状态、网络与运行依赖。平台规则可能变化，支持不代表每条视频始终可用。仍有问题可发邮件到 support@keep.video，附系统、版本与脱敏错误信息。",
          "Confirm the link works in a browser, update yt-dlp, then check login state, network and runtime tools using the troubleshooting guide. Platforms change; support does not mean every video always works. Email support@keep.video with your operating system, app version and a redacted error message."
        ]
      ]
    ],
    "related": [
      "getting-started",
      "troubleshooting"
    ]
  },
  {
    "slug": "vimeo-video-downloader",
    "name": "Vimeo",
    "category": [
      "Vimeo 下载指南",
      "VIMEO GUIDE"
    ],
    "title": [
      "Vimeo 视频下载器：保存授权视频",
      "Vimeo Video Downloader for Desktop"
    ],
    "description": [
      "使用 Keep Video 在电脑保存已获授权的 Vimeo 视频。了解视频页面链接、来源画质、密码访问和隐私设置限制。",
      "Save permitted Vimeo videos with Keep Video on your desktop. Learn about video page URLs, source quality, password access and privacy restrictions."
    ],
    "intro": [
      "Keep Video 通过 yt-dlp 提供 Vimeo 视频下载支持，在 macOS、Windows 和 Linux 本地运行。此网页介绍操作方法，实际解析和保存需要安装桌面应用。",
      "Keep Video supports Vimeo video downloading through yt-dlp on macOS, Windows and Linux. This page explains the workflow; install the desktop app to parse links and save files."
    ],
    "sections": [
      [
        [
          "安装并准备工具",
          "Install and prepare the tools"
        ],
        [
          "下载适合系统的 Keep Video，在设置中确认 yt-dlp 与 FFmpeg 可用。只保存你拥有或已获授权的内容。",
          "Install Keep Video for your operating system and check yt-dlp and FFmpeg in Settings. Save content you own or have permission to download."
        ]
      ],
      [
        [
          "优先使用视频页面地址",
          "Use the video page address"
        ],
        [
          "复制 Vimeo 视频页面链接。若视频嵌入其他网站，先确认你是否能访问对应 Vimeo 页面；嵌入播放成功并不代表视频允许下载。",
          "Copy the Vimeo video page URL. For an embedded player, first check whether you can access its Vimeo page. Successful embedded playback does not necessarily mean downloads are permitted."
        ]
      ],
      [
        [
          "画质与作者提供的下载",
          "Quality and creator-provided downloads"
        ],
        [
          "如果作者已开放 Vimeo 官方下载按钮，可优先使用。使用客户端时只选择解析返回的格式，原始文件或特定分辨率不一定可用。",
          "If the creator enables Vimeo’s own download button, that is a useful first option. In the app, choose only returned formats; original files and particular resolutions may be unavailable."
        ]
      ],
      [
        [
          "密码、隐私与付费内容",
          "Passwords, privacy and paid content"
        ],
        [
          "受密码保护、限定域名或付费视频有额外访问条件。Keep Video 不解锁这些权限，也不保证所有受保护视频可解析。先联系作者取得合适的下载授权或文件。",
          "Password protection, domain restrictions and paid access add separate requirements. Keep Video does not unlock those permissions or guarantee extraction of protected videos. Ask the creator for download permission or a file."
        ]
      ],
      [
        [
          "解析失败时怎么做",
          "If extraction fails"
        ],
        [
          "确认浏览器能正常访问链接，更新 yt-dlp，再按故障指南检查登录状态、网络与运行依赖。平台规则可能变化，支持不代表每条视频始终可用。仍有问题可发邮件到 support@keep.video，附系统、版本与脱敏错误信息。",
          "Confirm the link works in a browser, update yt-dlp, then check login state, network and runtime tools using the troubleshooting guide. Platforms change; support does not mean every video always works. Email support@keep.video with your operating system, app version and a redacted error message."
        ]
      ]
    ],
    "related": [
      "getting-started",
      "troubleshooting"
    ]
  }
]
