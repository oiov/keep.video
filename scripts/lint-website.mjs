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
  assert(title&&!titles.has(title),'重复或缺失 title'); titles.add(title)
  assert(description&&!descriptions.has(description),'重复或缺失 description');descriptions.add(description)
  const prefixes={'zh':'zh-CN','es':'es','pt-br':'pt-BR','de':'de','fr':'fr','ja':'ja','ko':'ko','ru':'ru'}
  assert(html.includes('<html lang="'+(prefixes[route.split('/')[1]]||'en')+'"'))
  assert.equal((html.match(/<link rel="alternate"/g)||[]).length,10)
  assert.equal((html.match(/class="language-options"/g)||[]).length,1)
  assert(!html.includes('downvid-coral')&&!html.includes('raw.githubusercontent.com'))
  for(const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1])
  if(route.endsWith('/app/')) {
   assert.equal((html.match(/<script[^>]+src=/g)||[]).length,1)
   assert(html.includes('src="/app/entry.js"'))
   assert(html.includes('"@type":"WebApplication"') && html.includes('"@type":"FAQPage"'))
   assert(html.includes('class="online-steps"') && html.includes('<noscript>'))
   assert(!html.includes('"@type":"Article"'))
  } else assert(!/<script[^>]+src=/.test(html),'门户不应引入执行脚本')
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
