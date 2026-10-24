// 官网展示只说明已有能力；本机 Cookie、依赖与更新必须归在桌面版内。
const copy = {
  title: ['好用的细节，<br><span>都替你想到了。</span>', 'Little details.<br><span>A better way to keep.</span>'],
  intro: ['在线轻松开始，桌面版提供更多控制。按你的使用方式，选择合适的工具。', 'Start in your browser. Get more control on desktop. Choose the way that works for you.'],
  platformsTitle: ['喜欢的内容，一个入口。', 'Your favorites. One place.'],
  platformsBody: ['基于 yt-dlp 支持多个平台，抖音、快手另有专用解析器。在线版接受公开链接；能否保存取决于来源与访问权限。', 'Powered by yt-dlp, with dedicated parsers for Douyin and Kuaishou. Use public links online; availability depends on the source and access permissions.'],
  formatsTitle: ['保留画面，也留下声音。', 'Keep the picture. Or just the sound.'],
  formatsBody: ['选择来源提供的画质，单独保存 MP3 音频、SRT 字幕，或选择可用的 YouTube 音轨。', 'Choose an available quality, save MP3 audio or SRT subtitles, and select from available YouTube audio tracks.'],
  source: ['画质与格式以来源为准', 'Quality and formats depend on the source'],
  desktopTitle: ['更多控制，交给桌面版。', 'More control, on your desktop.'],
  desktopNote: ['以下能力在桌面应用中使用。在线工具不读取本机 Cookie，也不管理本机依赖或应用更新。', 'These features belong to the desktop app. The online tool cannot read local cookies or manage local tools and app updates.'],
  accelerationTitle: ['下载加速', 'Download acceleration'],
  accelerationBody: ['直链分块下载，默认 8 路、最多 16 路；可选 aria2c。实际速度取决于网络与来源限制。', 'Direct downloads use 8 connections by default, up to 16, with optional aria2c. Actual speed depends on your connection and the source.'],
  cookiesTitle: ['登录内容', 'Signed-in content'],
  cookiesBody: ['读取你自己浏览器的登录状态，或导入 cookies.txt。仅用于你有权访问的内容，不绕过平台限制。', 'Use your own browser session or import cookies.txt for content you can access. This does not bypass platform restrictions.'],
  dependenciesTitle: ['依赖自动识别', 'Runtime tools, detected'],
  dependenciesBody: ['优先复用已有的 yt-dlp、FFmpeg 等工具；缺少时一键下载。YouTube 所需的 Node / Deno 仍需另行安装。', 'Reuse installed tools such as yt-dlp and FFmpeg, or download missing ones in a click. Node / Deno for YouTube still needs a separate installation.'],
  updatesTitle: ['更新更省心', 'Stay up to date'],
  updatesBody: ['从本项目 GitHub Releases 检查新版本，按安装方式应用更新；便携版等方式会引导前往下载页。', 'Check this project’s GitHub Releases for new versions. Update in the app where supported, or open the downloads page for portable and other installs.'],
  desktopLink: ['探索桌面版', 'Explore the desktop app'],
}

const icon = (paths) => '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>'
const icons = {
  acceleration: icon('<path d="M3 7h13M3 12h9M3 17h6M17 10l-3 5h4l-3 5"/>'),
  cookies: icon('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>'),
  dependencies: icon('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9v9M4 7.5l8 4.5 8-4.5M8 5.3l8 4.5"/>'),
  updates: icon('<path d="M20 8a8 8 0 0 0-13.5-3L3 8m0-5v5h5M4 16a8 8 0 0 0 13.5 3l3.5-3m0 5v-5h-5"/>'),
}

export function renderCapabilities(t, desktopUrl) {
  const desktopFeatures = ['acceleration', 'cookies', 'dependencies', 'updates']
  return `<section class="section capability-section" id="capabilities" aria-labelledby="capabilities-title">
    <div class="section-heading capability-heading"><h2 id="capabilities-title">${t(copy.title)}</h2><p>${t(copy.intro)}</p></div>
    <div class="capability-highlights">
      <article class="capability-highlight" data-capability="platforms">
        <span class="capability-number" aria-hidden="true">01</span>
        <h3>${t(copy.platformsTitle)}</h3><p>${t(copy.platformsBody)}</p>
        <ul class="capability-platforms">${['YouTube', 'Bilibili', 'X / Twitter', 'TikTok', 'Instagram', 'Vimeo', t(['抖音', 'Douyin']), t(['快手', 'Kuaishou'])].map(name => `<li>${name}</li>`).join('')}</ul>
      </article>
      <article class="capability-highlight" data-capability="formats">
        <span class="capability-number" aria-hidden="true">02</span>
        <h3>${t(copy.formatsTitle)}</h3><p>${t(copy.formatsBody)}</p>
        <div class="capability-formats"><div class="capability-quality"><strong>4K</strong><span>${t(copy.source)}</span></div><ul class="capability-files" aria-hidden="true"><li>MP4</li><li>MP3</li><li>SRT</li></ul></div>
      </article>
    </div>
    <div class="capability-desktop" aria-labelledby="capability-desktop-title">
      <div class="capability-desktop-heading"><div><h3 id="capability-desktop-title">${t(copy.desktopTitle)}</h3><p class="capability-boundary">${t(copy.desktopNote)}</p></div><a class="text-link" href="${desktopUrl}">${t(copy.desktopLink)}<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 13 13 3M3 3h10v10"/></svg></a></div>
      <div class="capability-desktop-grid">${desktopFeatures.map((key, i) => `<article class="capability-detail" data-capability="${key}"><div class="capability-detail-mark">${icons[key]}<span aria-hidden="true">0${i + 3}</span></div><h4>${t(copy[key + 'Title'])}</h4><p>${t(copy[key + 'Body'])}</p></article>`).join('')}</div>
    </div>
  </section>`
}
