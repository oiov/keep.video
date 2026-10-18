// 官网抓取与发布模式回归；复用已有三个平台 CI 的 lint:website 入口。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out=path.join(root,'website/dist')
const build=(env={})=>execFileSync(process.execPath,['scripts/build-website.mjs'],{cwd:root,env:{...process.env,SITE_URL:'',SITE_PREVIEW:'',VERCEL_ENV:'',...env},stdio:'pipe'})
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)])
// 每种语言独立锁定双端定位，不能只验证词条存在或从生产文案生成预期值。
const modeWords={en:[/online/i,/desktop/i],zh:[/在线/,/桌面/],es:[/online/i,/escritorio/i],'pt-br':[/online/i,/desktop/i],de:[/online/i,/desktop/i],fr:[/en ligne/i,/ordinateur|bureau/i],ja:[/オンライン/,/デスクトップ/],ko:[/온라인/,/데스크톱/],ru:[/онлайн/i,/компьютер/i]}
try {
 build({SITE_URL:'https://seo-check.test'})
 const pages=files(out).filter(f=>f.endsWith('index.html'))
 assert.equal(pages.length,117)
 for(const platform of ['youtube','bilibili','tiktok','instagram','vimeo']) for(const prefix of ['', 'zh/', 'es/', 'pt-br/', 'de/', 'fr/', 'ja/', 'ko/', 'ru/']) {
  const html=fs.readFileSync(path.join(out,prefix+platform+'-video-downloader/index.html'),'utf8')
  assert(html.includes('support@keep.video'))
  assert(html.includes('yt-dlp supported sites'))
 }
 assert(fs.readFileSync(path.join(out,'llms.txt'),'utf8').includes('support@keep.video'))
 const titles=new Set(), descriptions=new Set()
 for(const file of pages){
  const html=fs.readFileSync(file,'utf8')
  const route='/'+path.relative(out,path.dirname(file)).split(path.sep).filter(Boolean).join('/')+(path.dirname(file)===out?'':'/')
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1,file)
  assert(html.includes('content="index,follow"'),file)
  const canonical=html.match(/rel="canonical" href="([^"]+)"/)?.[1]
  assert.equal(canonical,'https://seo-check.test'+route)
  assert.equal((html.match(/hreflang="x-default"/g)||[]).length,1)
  const title=html.match(/<title>(.*?)<\/title>/)?.[1]
  const description=html.match(/name="description" content="([^"]+)"/)?.[1]
  const language=route.split('/')[1] in modeWords?route.split('/')[1]:'en'
  const article=route.includes('-video-downloader/')||/\/guides\/[^/]+\/$/.test(route)
  if(route.includes('-video-downloader/')||route.endsWith('/guides/getting-started/')) {
   for(const word of modeWords[language]) {
    assert(word.test(title),'标题缺少在线或桌面定位：'+route)
    assert(word.test(description),'描述缺少在线或桌面定位：'+route)
    assert(word.test(html.match(/<h1>(.*?)<\/h1>/)?.[1]),'H1 缺少双端定位：'+route)
   }
   assert.equal(html.match(/property="og:title" content="([^"]+)"/)?.[1],title)
   assert.equal(html.match(/property="og:description" content="([^"]+)"/)?.[1],description)
  }
  if(article) {
   const online=html.indexOf('<section id="online-workflow"')
   const desktop=html.indexOf('<section id="desktop-workflow"')
   assert(online>=0&&desktop>online,'指南必须先解释在线操作，再限定桌面步骤：'+route)
   assert(desktop<html.indexOf('<section id="step-0"'),'本机配置必须在桌面章节内：'+route)
   const workflow=html.slice(online,desktop)
   const prefix=language==='en'?'':language+'/'
   assert(workflow.includes('href="/'+prefix+'app/"'),'正文缺少当前语言在线入口：'+route)
   for(const word of modeWords[language]) assert(word.test(workflow),'在线说明缺少模式边界：'+route)
   assert(!html.includes('This website provides information and download links;')&&!html.includes('网页提供介绍与下载入口'),'不得恢复网站仅供介绍的旧描述')
  }
  assert(title&&!titles.has(title),'重复或缺失 title'); titles.add(title)
  assert(description&&!descriptions.has(description),'重复或缺失 description');descriptions.add(description)
  const prefixes={'zh':'zh-CN','es':'es','pt-br':'pt-BR','de':'de','fr':'fr','ja':'ja','ko':'ko','ru':'ru'}
  assert(html.includes('<html lang="'+(prefixes[route.split('/')[1]]||'en')+'"'))
  assert.equal((html.match(/<link rel="alternate"/g)||[]).length,10)
  assert.equal((html.match(/class="language-options"/g)||[]).length,1)
  assert(!html.includes('downvid-coral')&&!html.includes('raw.githubusercontent.com'))
  for(const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1])
  const trackingScripts = html.match(/<script[^>]+src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*><\/script>/g) || []
  assert.equal(trackingScripts.length,1,'每页必须且只能加载一次 Umami')
  assert.equal(trackingScripts[0],'<script defer src="https://cloud.umami.is/script.js" data-website-id="b8ead086-206d-4f73-9b5e-82bf119f3591"></script>')
  if(route.endsWith('/app/')) {
   assert.equal((html.match(/<script[^>]+src=/g)||[]).length,2)
   assert(html.includes('src="/app/entry.js"'))
   assert(html.includes('"@type":"WebApplication"') && html.includes('"@type":"FAQPage"'))
   assert(html.includes('class="online-steps"') && html.includes('<noscript>'))
   assert(!html.includes('"@type":"Article"'))
  } else assert.equal((html.match(/<script[^>]+src=/g)||[]).length,1,'门户只应加载 Umami 统计脚本')
  for(const m of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)){
   const href=m[1]
   if(!href.startsWith('/'))continue
   if(href === '/app/entry.js')continue
   const target=path.join(out,href.endsWith('/')?href+'index.html':href)
   assert(fs.existsSync(target),'损坏的内链/资源：'+href)
  }
  for(const m of html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)){
   const alternate=fs.readFileSync(path.join(out,new URL(m[2]).pathname,'index.html'),'utf8')
   assert(alternate.includes('href="'+canonical+'"'),'缺失语言回链')
  }
 }
 const sitemap=fs.readFileSync(path.join(out,'sitemap.xml'),'utf8')
 assert.equal((sitemap.match(/<loc>/g)||[]).length,117)
 assert(fs.readFileSync(path.join(out,'robots.txt'),'utf8').includes('Sitemap: https://seo-check.test/sitemap.xml'))
 const social=fs.readFileSync(path.join(out,'assets/social.png'))
 assert.equal(social.readUInt32BE(16),1200);assert.equal(social.readUInt32BE(20),630)
 build({SITE_URL:'https://seo-check.test',VERCEL_ENV:'preview'})
 assert(fs.readFileSync(path.join(out,'index.html'),'utf8').includes('content="noindex,follow"'))
 assert(!fs.readFileSync(path.join(out,'sitemap.xml'),'utf8').includes('<loc>'))
 build({SITE_URL:'https://seo-check.test',SITE_PREVIEW:'1'})
 assert(fs.readFileSync(path.join(out,'index.html'),'utf8').includes('content="noindex,follow"'))
 build()
 const preview=fs.readFileSync(path.join(out,'index.html'),'utf8')
 assert(preview.includes('content="noindex,follow"'))
 assert(!preview.includes('rel="canonical"'))
 assert(!preview.includes('hreflang="x-default"'))
 assert(!fs.readFileSync(path.join(out,'sitemap.xml'),'utf8').includes('<loc>'))
 for(const invalid of ['http://site.test','https://site.test/path','https://site.test?key=a','https://user:password@site.test','https://example.com'])assert.throws(()=>build({SITE_URL:invalid}))
 console.log('官网校验通过：117 个九语言页面、独立元数据、语言回链、JSON-LD、资源、生产/预览模式与域名校验。')
} finally {execFileSync(process.execPath,['scripts/build-website.mjs'],{cwd:root,stdio:'pipe'})}
