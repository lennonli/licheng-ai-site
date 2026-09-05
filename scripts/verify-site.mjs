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
  const direct = path.join(dist, clean)
  if (existsSync(direct) && statSync(direct).isFile()) return direct
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
for (const required of ['/tools/', '06 / Tools', '04 / Series', '实用工具']) {
  if (!homeHtml.includes(required)) fail(`Homepage tools entry is missing ${required}`)
}

const seriesIndexFile = targetFile('/series/')
const aiBasicsSeriesFile = targetFile('/series/ai-basics/')
const aiInfraSeriesFile = targetFile('/series/ai-infra/')
const aiPracticeSeriesFile = targetFile('/series/ai-practice/')
const aiPrioritySeriesFile = targetFile('/series/ai-priority/')
const aiNotesSeriesFile = targetFile('/series/ai-notes/')
const civilLitigationSeriesFile = targetFile('/series/civil-litigation/')
if (!seriesIndexFile || !aiBasicsSeriesFile || !aiInfraSeriesFile || !aiPracticeSeriesFile || !aiPrioritySeriesFile || !aiNotesSeriesFile || !civilLitigationSeriesFile) {
  fail('Series pages are incomplete')
} else {
  const seriesIndexHtml = readFileSync(seriesIndexFile, 'utf8')
  const aiBasicsSeriesHtml = readFileSync(aiBasicsSeriesFile, 'utf8')
  const aiPrioritySeriesHtml = readFileSync(aiPrioritySeriesFile, 'utf8')
  for (const required of ['/series/ai-basics/', '/series/ai-infra/', '/series/ai-practice/', '/series/ai-priority/', '/series/ai-notes/', '/series/civil-litigation/', '系列列表']) {
    if (!seriesIndexHtml.includes(required)) fail(`Series index is missing ${required}`)
  }
  const seriesCardCount = (seriesIndexHtml.match(/class="index-card"/g) || []).length
  if (seriesCardCount !== 6) fail(`Series index expected 6 series cards, found ${seriesCardCount}`)
  const seriesTocExpectations = [
    [aiBasicsSeriesFile, 30, 'AI basics series'],
    [aiInfraSeriesFile, 10, 'AI infra series'],
    [aiPracticeSeriesFile, 51, 'AI practice series'],
    [aiPrioritySeriesFile, 26, 'AI priority series'],
    [aiNotesSeriesFile, 4, 'AI notes series'],
    [civilLitigationSeriesFile, 11, 'Civil litigation series']
  ]
  for (const [file, minLinks, label] of seriesTocExpectations) {
    const html = readFileSync(file, 'utf8')
    const linkCount = (html.match(/href="\/tutorials\//g) || []).length
    if (linkCount < minLinks) fail(`${label} expected at least ${minLinks} tutorial links, found ${linkCount}`)
  }

  const presentationFile = targetFile('/series/ai-basics/presentation/')
  if (!presentationFile) {
    fail('AI basics presentation page is missing')
  } else {
    const presentationHtml = readFileSync(presentationFile, 'utf8')
    if (!aiBasicsSeriesHtml.includes('series-presentation-card')) fail('AI basics series presentation card is missing')
    const slideDataCount = (presentationHtml.match(/(?:id":\s*"|id:\s*')ai-basics-\d{2}/g) || []).length
    if (slideDataCount !== 30) fail(`AI basics presentation expected 30 slide data entries, found ${slideDataCount}`)
    for (const required of ['slideViewport.insertAdjacentHTML', 'previous-slide', 'next-slide', 'notes-panel', 'visual-flow', 'visual-map']) {
      if (!presentationHtml.includes(required)) fail(`AI basics presentation is missing ${required}`)
    }
  }

  const priorityPresentationFile = targetFile('/series/ai-priority/presentation/')
  if (!priorityPresentationFile) {
    fail('AI priority presentation page is missing')
  } else {
    const presentationHtml = readFileSync(priorityPresentationFile, 'utf8')
    if (!aiPrioritySeriesHtml.includes('series-presentation-card')) fail('AI priority series presentation card is missing')
    const slideDataCount = (presentationHtml.match(/(?:id":\s*"|id:\s*')ai-priority-\d{2}/g) || []).length
    if (slideDataCount !== 26) fail(`AI priority presentation expected 26 slide data entries, found ${slideDataCount}`)
    for (const required of ['slideViewport.insertAdjacentHTML', 'previous-slide', 'next-slide', 'notes-panel', 'visual-flow', 'visual-map']) {
      if (!presentationHtml.includes(required)) fail(`AI priority presentation is missing ${required}`)
    }
  }
}

const toolsIndexFile = targetFile('/tools/')
const legalToolsFile = targetFile('/tools/legal-tools')
const networkSitesFile = targetFile('/tools/network-check-sites')
const aiDirectoryFile = targetFile('/tools/ai-directory')
if (!toolsIndexFile || !legalToolsFile || !networkSitesFile || !aiDirectoryFile) {
  fail('Practical tools pages are incomplete')
} else {
  const toolsIndexHtml = readFileSync(toolsIndexFile, 'utf8')
  const legalToolsHtml = readFileSync(legalToolsFile, 'utf8')
  const networkSitesHtml = readFileSync(networkSitesFile, 'utf8')
  for (const required of ['/tools/legal-tools', '/tools/network-check-sites', '法律工具', '网核网站']) {
    if (!toolsIndexHtml.includes(required)) fail(`Tools index is missing ${required}`)
  }
  const aiDirectoryHtml = readFileSync(aiDirectoryFile, 'utf8')
  for (const required of ['/tools/legal-tools', '/tools/network-check-sites', 'AI 网站导航']) {
    if (!toolsIndexHtml.includes(required)) fail(`Tools index is missing ${required}`)
  }
  for (const required of ['ChatGPT', '北大法宝', '国家法律法规数据库', '域名与安全核验重点', '维护建议']) {
    if (!aiDirectoryHtml.includes(required)) fail(`AI directory page is missing ${required}`)
  }
  const directoryEntryCount = (aiDirectoryHtml.match(/<strong>/g) || []).length
  if (directoryEntryCount < 450) fail(`AI directory page expected at least 450 entries, found ${directoryEntryCount}`)

  const dashboardFile = targetFile('/dashboard/')
  const dashboardDataFile = path.join(dist, 'dashboard', 'data.enc.json')
  if (!dashboardFile || !existsSync(dashboardDataFile)) {
    fail('Dashboard page or encrypted data is missing')
  } else {
    const dashboardHtml = readFileSync(dashboardFile, 'utf8')
    if (!/<meta name="robots" content="noindex/.test(dashboardHtml)) fail('Dashboard page must be noindex')
    if (!dashboardHtml.includes('data.enc.json')) fail('Dashboard page does not reference encrypted data')
    if (statSync(dashboardDataFile).size < 500) fail('Dashboard encrypted data looks too small')
    const encrypted = JSON.parse(readFileSync(dashboardDataFile, 'utf8'))
    if (!encrypted.salt || !encrypted.iv || !encrypted.data) fail('Dashboard encrypted data envelope is incomplete')
  }
  const siteCardCount = (networkSitesHtml.match(/class="tool-site-card"/g) || []).length
  if (siteCardCount !== 17) fail(`Network-check sites page expected 17 sites, found ${siteCardCount}`)
  for (const required of ['企业登记与公共信用', '知识产权与域名', '行政监管与专项合规', '司法与执法', '综合信息检索', '国家企业信用信息公示系统', '信用中国', '中国海关企业信用信息公示平台', '中国执行信息公开网', '国家税务总局深圳市税务局', '证券期货市场失信记录查询平台', '国家市场监督管理总局行政处罚文书网', '深圳市市场监督管理局', '国家外汇管理局', '12309中国检察网', '上海证券交易所', '百度', 'IPE', '全国排污许可证管理信息平台', '中国商标网商标网上检索', '中国专利公布公告查询', 'ICP/IP地址/域名信息备案管理系统']) {
    if (!networkSitesHtml.includes(required)) fail(`Network-check sites page is missing ${required}`)
  }
}

for (const file of htmlFiles) {
  const route = routeFor(file)
  const html = readFileSync(file, 'utf8')
  const isImmersive = route.startsWith('/tutorial-views/')
  const isPrivateUtility = route.startsWith('/__analytics-') || route.startsWith('/dashboard')
  const isPresentation = route.startsWith('/series/') && route.endsWith('/presentation/')
  const isNotFound = route === '/404'
  const noWechatContactRoutes = new Set(['/tools/course-ppt/'])
  if (!isImmersive && !isPrivateUtility) {
    const h1Count = (html.match(/<h1\b/g) || []).length
    if (!isNotFound && !isPresentation && h1Count !== 1) fail(`${route}: expected one H1, found ${h1Count}`)
    if (!isNotFound && !noWechatContactRoutes.has(route) && !isPresentation && !html.includes('wechat-contact')) fail(`${route}: WeChat contact section missing`)
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
    if (raw.includes('${')) continue
    const target = raw.split('#', 1)[0]
    if (/%E3%80%82|%EF%BC%9B|%EF%BC%8C/i.test(target)) fail(`${route}: malformed URL ${raw}`)
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

const articleFiles = htmlFiles.filter((file) => /\/(agents|skills|tutorials|kb|kb2025|kb2024|kb2023)\/.+\.html$/.test(file) && !/\/index\.html$/.test(file))
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
