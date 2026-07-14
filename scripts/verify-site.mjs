import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'site', '.vitepress', 'dist')
const failures = []
const articleToolsSource = readFileSync(path.join(root, 'site', '.vitepress', 'theme', 'ArticleTools.vue'), 'utf8')
const wechatQrFile = path.join(dist, 'wechat-li-cheng.jpg')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name)
    return statSync(file).isDirectory() ? walk(file) : [file]
  })
}

function decodeHtml(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

function routeFor(file) {
  const relative = path.relative(dist, file).split(path.sep).join('/')
  if (relative === 'index.html') return '/'
  return `/${relative.replace(/\/index\.html$/, '/').replace(/\.html$/, '')}`
}

function targetFile(pathname) {
  if (pathname === '/') return path.join(dist, 'index.html')
  const clean = decodeURIComponent(pathname).replace(/^\//, '').replace(/\/$/, '')
  const html = path.join(dist, `${clean}.html`)
  const index = path.join(dist, clean, 'index.html')
  if (existsSync(html)) return html
  if (existsSync(index)) return index
  return null
}

function fail(message) {
  failures.push(message)
}

if (!existsSync(dist)) throw new Error('Build output is missing')
const files = walk(dist)
const htmlFiles = files.filter((file) => file.endsWith('.html'))
if (htmlFiles.length < 20) fail(`Expected at least 20 HTML pages, found ${htmlFiles.length}`)

if (!existsSync(wechatQrFile)) {
  fail('WeChat QR image is missing from the build output')
} else if (statSync(wechatQrFile).size < 50_000) {
  fail('WeChat QR image appears incomplete')
}

const homeHtml = readFileSync(path.join(dist, 'index.html'), 'utf8')
for (const required of ['wechat-contact', '联系李成律师', '/wechat-li-cheng.jpg', '扫码添加微信']) {
  if (!homeHtml.includes(required)) fail(`Homepage WeChat contact section is missing ${required}`)
}

for (const file of htmlFiles) {
  const route = routeFor(file)
  const html = readFileSync(file, 'utf8')
  const isImmersive = route.startsWith('/tutorial-views/')
  const isPrivateUtility = route.startsWith('/__analytics-')
  const isNotFound = route === '/404'
  if (!isImmersive && !isPrivateUtility) {
    const h1Count = (html.match(/<h1\b/g) || []).length
    if (!isNotFound && h1Count !== 1) fail(`${route}: expected one H1, found ${h1Count}`)
    if (!isNotFound && !html.includes('wechat-contact')) fail(`${route}: WeChat contact section missing`)
    if (!/<link rel="canonical" href="https:\/\/ai\.licheng\.uk\//.test(html)) fail(`${route}: canonical missing`)
    if (!/<meta property="og:url"/.test(html)) fail(`${route}: og:url missing`)
  }
  if ((isImmersive || isPrivateUtility) && !/<meta name="robots" content="noindex/.test(html)) {
    fail(`${route}: private or immersive page must be noindex`)
  }
  if (isImmersive) {
    for (const image of html.matchAll(/<img\b([^>]*)>/gi)) {
      const attributes = image[1]
      if (!/\bloading="lazy"/i.test(attributes)) fail(`${route}: image is missing lazy loading`)
      if (!/\bdecoding="async"/i.test(attributes)) fail(`${route}: image is missing async decoding`)
      if (/\bsrc="data:image\/png;base64,/i.test(attributes) && !/\bwidth="\d+"[^>]*\bheight="\d+"/i.test(attributes)) {
        fail(`${route}: embedded PNG is missing intrinsic dimensions`)
      }
    }
  }

  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => decodeHtml(match[1])))
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const raw = decodeHtml(match[1])
    if (/%E3%80%82|%EF%BC%9B|%EF%BC%8C/i.test(raw)) fail(`${route}: malformed URL ${raw}`)
    let url
    try { url = new URL(raw, `https://ai.licheng.uk${route}`) } catch { continue }
    if (url.origin !== 'https://ai.licheng.uk') continue
    const samePage = url.pathname === new URL(`https://ai.licheng.uk${route}`).pathname
    if (samePage && url.hash) {
      const id = decodeURIComponent(url.hash.slice(1))
      if (id && !ids.has(id)) fail(`${route}: missing anchor #${id}`)
    }
    if (!url.hash && !/\.(?:png|jpe?g|svg|webp|ico|woff2?|css|js|json|xml)$/i.test(url.pathname)) {
      if (!targetFile(url.pathname)) fail(`${route}: missing internal page ${url.pathname}`)
    }
  }
}

const articleFiles = htmlFiles.filter((file) => /\/(agents|skills|tutorials)\/.+\.html$/.test(file) && !/\/index\.html$/.test(file))
for (const file of articleFiles) {
  const html = readFileSync(file, 'utf8')
  if (!html.includes('article-updated')) fail(`${routeFor(file)}: update date missing`)
  if (!html.includes('分享文章')) fail(`${routeFor(file)}: share button missing`)
}

for (const required of ['article-share-panel', '微信', 'twitter.com/intent/tweet', 'service.weibo.com', 'facebook.com/sharer', '复制链接']) {
  if (!articleToolsSource.includes(required)) fail(`Article share implementation is missing ${required}`)
}

const htmlTutorialWrappers = articleFiles.filter((file) => readFileSync(file, 'utf8').includes('html-tutorial-frame'))
for (const file of htmlTutorialWrappers) {
  const slug = path.basename(file, '.html')
  const copyFile = path.join(dist, 'tutorial-copy', `${slug}.txt`)
  if (!existsSync(copyFile)) fail(`${routeFor(file)}: HTML tutorial copy source missing`)
  else if (readFileSync(copyFile, 'utf8').trim().length < 1000) fail(`${routeFor(file)}: HTML tutorial copy source is incomplete`)
}

for (const required of ['sitemap.xml', 'feed.xml', 'robots.txt', '_headers', 'source-manifest.json']) {
  if (!existsSync(path.join(dist, required))) fail(`Missing ${required}`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Verified ${htmlFiles.length} HTML pages with no broken internal page or anchor references.`)
