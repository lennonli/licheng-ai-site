import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { createMarkdownRenderer } from 'vitepress'

const root = process.cwd()
const cacheDir = path.join(root, '.cache', 'source-repos')
const siteDir = path.join(root, 'site')
const markdownRenderer = await createMarkdownRenderer(siteDir)
const sourceRevisions = new Map()

const sources = [
  {
    key: 'agents',
    name: 'AGENTS 指令',
    repo: 'https://github.com/lennonli/licheng-AGENTS.md.git',
    localRepo: path.resolve(root, '..', 'licheng-AGENTS.md')
  },
  {
    key: 'skills',
    name: 'Agent Skills',
    repo: 'https://github.com/lennonli/licheng-skills.git',
    localRepo: path.resolve(root, '..', 'licheng-skills')
  },
  {
    key: 'tutorials',
    name: 'AI 教程',
    repo: 'https://github.com/lennonli/licheng-AI-tutorials.git',
    localRepo: path.resolve(root, '..', 'licheng-AI-tutorials')
  }
]

const sourceWebUrls = {
  agents: 'https://github.com/lennonli/licheng-AGENTS.md',
  skills: 'https://github.com/lennonli/licheng-skills',
  tutorials: 'https://github.com/lennonli/licheng-AI-tutorials',
  site: 'https://github.com/lennonli/licheng-ai-site'
}

function sh(cmd, args, cwd = root) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

function syncSourceRepo(source) {
  const dest = path.join(cacheDir, source.key)
  if (source.localRepo && existsSync(path.join(source.localRepo, '.git'))) {
    console.log(`Using local source repo for ${source.key}: ${source.localRepo}`)
    sh('git', ['clone', source.localRepo, dest])
  } else {
    sh('git', ['clone', source.repo, dest])
  }

  const requestedRevision = process.env[`SOURCE_${source.key.toUpperCase()}_SHA`]
  if (requestedRevision) sh('git', ['checkout', '--detach', requestedRevision], dest)
  const revision = gitText(['rev-parse', 'HEAD'], dest)
  sourceRevisions.set(source.key, revision)
  return revision
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function readDirSafe(dir) {
  return existsSync(dir) ? readdirSync(dir) : []
}

function copyMarkdownFiles(src, dest) {
  ensureDir(dest)
  for (const name of readDirSafe(src).sort()) {
    const from = path.join(src, name)
    if (!statSync(from).isFile()) continue
    if (!name.endsWith('.md')) continue
    cpSync(from, path.join(dest, name))
  }
}

function copyTutorialHtmlFiles(src, dest) {
  const copied = []
  ensureDir(dest)
  for (const name of readDirSafe(src).sort()) {
    const from = path.join(src, name)
    if (!statSync(from).isFile()) continue
    if (!name.endsWith('.html')) continue

    const slug = name.replace(/\.html$/, '')
    const pageDir = path.join(dest, slug)
    ensureDir(pageDir)
    const html = enrichHtmlImages(readFileSync(from, 'utf8'))
    const robots = '<meta name="robots" content="noindex,nofollow,noarchive">'
    const prepared = html.includes('name="robots"')
      ? html
      : html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n  ${robots}`)
    writeFileSync(path.join(pageDir, 'index.html'), prepared)
    copied.push({ name, slug })
  }
  return copied
}

function pngDimensionsFromBuffer(data) {
  if (data.length < 24 || data.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

function enrichHtmlImages(html) {
  return html.replace(/<img\b([^>]*?)>/gi, (match, attributes) => {
    const source = attributes.match(/\bsrc=(['"])(.*?)\1/i)?.[2] || ''
    let dimensions = null
    const dataMatch = source.match(/^data:image\/png;base64,(.+)$/i)
    if (dataMatch) {
      try {
        dimensions = pngDimensionsFromBuffer(Buffer.from(dataMatch[1], 'base64'))
      } catch {
        dimensions = null
      }
    }

    const loading = /\bloading=/i.test(attributes) ? '' : ' loading="lazy"'
    const decoding = /\bdecoding=/i.test(attributes) ? '' : ' decoding="async"'
    const width = dimensions && !/\bwidth=/i.test(attributes) ? ` width="${dimensions.width}"` : ''
    const height = dimensions && !/\bheight=/i.test(attributes) ? ` height="${dimensions.height}"` : ''
    return `<img${attributes}${loading}${decoding}${width}${height}>`
  })
}

function backButton(fallback) {
  return `<BackButton fallback="${fallback}" />\n\n`
}

function encodeGitHubPath(relativePath) {
  return relativePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')
}

function githubBlobUrl(repoWebUrl, relativePath) {
  return `${repoWebUrl}/blob/main/${encodeGitHubPath(relativePath)}`
}

function articleTools(githubUrl, updatedAt = '', immersiveUrl = '') {
  const updated = updatedAt ? ` updated-at="${formatDate(updatedAt)}"` : ''
  const immersive = immersiveUrl ? ` immersive-url="${immersiveUrl}"` : ''
  return `<ArticleTools github-url="${githubUrl}"${updated}${immersive} />\n\n`
}

function withBackButton(markdown, fallback) {
  if (markdown.includes('<BackButton ')) return markdown
  if (!markdown.startsWith('---\n')) return `${backButton(fallback)}${markdown}`

  const end = markdown.indexOf('\n---', 4)
  if (end === -1) return `${backButton(fallback)}${markdown}`
  const frontmatterEnd = end + 4
  return `${markdown.slice(0, frontmatterEnd)}\n\n${backButton(fallback)}${markdown.slice(frontmatterEnd).trimStart()}`
}

function withArticleTools(markdown, githubUrl, updatedAt = '', immersiveUrl = '') {
  if (markdown.includes('<ArticleTools ')) return markdown

  const backButtonMatch = markdown.match(/<BackButton [^\n]+\/>\n*/)
  if (backButtonMatch && backButtonMatch.index !== undefined) {
    const insertAt = backButtonMatch.index + backButtonMatch[0].length
    return `${markdown.slice(0, insertAt)}\n${articleTools(githubUrl, updatedAt, immersiveUrl)}${markdown.slice(insertAt).trimStart()}`
  }

  if (!markdown.startsWith('---\n')) return `${articleTools(githubUrl, updatedAt, immersiveUrl)}${markdown}`

  const end = markdown.indexOf('\n---', 4)
  if (end === -1) return `${articleTools(githubUrl, updatedAt, immersiveUrl)}${markdown}`
  const frontmatterEnd = end + 4
  return `${markdown.slice(0, frontmatterEnd)}\n\n${articleTools(githubUrl, updatedAt, immersiveUrl)}${markdown.slice(frontmatterEnd).trimStart()}`
}

function withArticleChrome(markdown, fallback, githubUrl, updatedAt = '', immersiveUrl = '') {
  return withArticleTools(withBackButton(markdown, fallback), githubUrl, updatedAt, immersiveUrl)
}

function addArticleChromeToMarkdownFiles(dir, fallback, repoWebUrl, repoDir, sourcePrefix = '') {
  for (const name of readDirSafe(dir).sort()) {
    if (!name.endsWith('.md') || name === 'index.md') continue
    const file = path.join(dir, name)
    const sourcePath = sourcePrefix ? `${sourcePrefix}/${name}` : name
    const updatedAt = gitLastUpdated(repoDir, sourcePath)
    writeFileSync(file, withArticleChrome(readFileSync(file, 'utf8'), fallback, githubBlobUrl(repoWebUrl, sourcePath), updatedAt))
  }
}

function listSkillDirs(src) {
  return readDirSafe(src)
    .filter((name) => {
      const full = path.join(src, name)
      return statSync(full).isDirectory() && existsSync(path.join(full, 'SKILL.md'))
    })
    .sort()
}

function stripYamlFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return markdown
  const end = markdown.indexOf('\n---', 4)
  if (end === -1) return markdown
  return markdown.slice(end + 4).trimStart()
}

const titleOverrides = new Map([
  ['agents/README.md', '仓库说明与使用建议'],
  ['agents/合同审查和起草.md', '合同审查和起草指令'],
  ['agents/股改文件起草.md', '股改文件起草指令'],
  ['agents/法律PPT设计.md', '法律 PPT 设计指令'],
  ['skills/cnipa-patent-evidence-archive', 'CNIPA 专利证据归档'],
  ['skills/cnipa-trademark-evidence-archive', 'CNIPA 商标证据归档'],
  ['skills/network-check-v3', '中国企业网络核查'],
  ['tutorials/macos-codex-legal-workflow-setup-ABL-20260707-V1.md', 'macOS + Codex 法律工作流环境安装教程'],
  ['tutorials/agent-instruction-tool-selection-training-ABL-20260708-V1.html', '智能体指令体系、工具选择培训讲义（HTML 翻页版）'],
  ['tutorials/proxy-clash-verge-full-guide-ABL-20260707-V2.html', '梯子使用全教程 HTML 自包含版'],
  ['tutorials/proxy-clash-verge-full-guide-ABL-20260707-V1.md', '代理工具全平台使用教程'],
  ['tutorials/windows-codex-legal-workflow-setup-ABL-20260707-V1.md', 'Windows + Codex 法律工作流环境安装教程']
])

const summaryOverrides = new Map([
  ['agents/README.md', '说明 AGENTS 指令仓库的用途、文件组成、叠加使用建议和维护规则，适合先判断应使用哪一类项目指令。'],
  ['agents/合同审查和起草.md', '规定合同审查、风险分级、缺失条款补充、法律文件起草、修订模式、签署页和版本命名等合同类任务的工作规则。'],
  ['agents/股改文件起草.md', '用于有限公司整体变更为股份有限公司的股改文件起草与复核，覆盖参考案例改造、资料填报、文件清单、特殊治理结构适配、一致性检查、模板残留清理、待补信息汇总和签署条件判断。'],
  ['agents/法律PPT设计.md', '规定法律培训、项目汇报和专业服务 PPT 的视觉风格、版式层级、字体字号、信息呈现方式以及既有 PPT 修改边界。'],
  ['agents/法律业务通用指令.md', '沉淀法律工作全局规则，包括默认客户立场、保密要求、法律依据核验、反编造红线、Word 格式、律所署名和交付方式。'],
  ['agents/法律尽调报告提示词.md', '沉淀法律尽职调查报告提示词，当前重点覆盖股权历史沿革章节，适合指导工商内档核查、股权变动底稿拆分、历史沿革初稿起草和补充材料清单整理。'],
  ['skills/cnipa-patent-evidence-archive', '用于从 CNIPA 中国及多国专利审查信息查询系统导出专利申请信息、费用信息、发文信息、质押和许可备案等页面证据，并按申请人和专利号整理成本地底稿。'],
  ['skills/cnipa-trademark-evidence-archive', '用于从 CNIPA 商标网上检索系统归档商标详情页和商标流程页，适合商标核查、知识产权尽调和证据留存。'],
  ['skills/network-check-v3', '用于中国企业主体和风险网络核查，批量检索信用、处罚、失信、监管和公开网页信息，并保存可追溯的 PDF 证据文件。'],
  ['tutorials/macos-codex-legal-workflow-setup-ABL-20260707-V1.md', '面向全新 macOS 和刚安装 Codex 的法律工作环境，覆盖 Homebrew、文档处理、PDF/OCR、Python 虚拟环境和 Codex 配置。'],
  ['tutorials/agent-instruction-tool-selection-training-ABL-20260708-V1.html', '面向律师团队的 AI Agent 培训讲义，覆盖大模型与 Agent 区分、指令体系、Codex 工具、Skill/MCP/Plugin、客户秘密保护和团队落地。'],
  ['tutorials/proxy-clash-verge-full-guide-ABL-20260707-V2.html', '代理工具全平台教程的自包含 HTML 版本，适合单文件保存和离线阅读。'],
  ['tutorials/proxy-clash-verge-full-guide-ABL-20260707-V1.md', '覆盖 macOS、Windows、Android 和 iOS 的代理客户端安装、订阅导入、模式选择、验证排错和法律工作中的安全注意事项。'],
  ['tutorials/windows-codex-legal-workflow-setup-ABL-20260707-V1.md', '面向全新 Windows 和刚安装 Codex 的法律工作环境，覆盖 PowerShell、winget、Office/PDF/OCR、WSL2 和法律文档处理依赖。']
])

const headingTitleOverrides = new Map([
  ['Goal', '目标'],
  ['Inputs', '输入信息'],
  ['Workflow', '工作流程'],
  ['Practical Notes', '实务注意事项'],
  ['Scripted Chrome Path', 'Chrome 自动化路径'],
  ['Lessons From Failed Runs', '失败运行经验'],
  ['When To Use', '适用场景'],
  ['Setup', '安装与准备'],
  ['Main Command', '主要命令'],
  ['Supported Platforms', '支持的平台'],
  ['Recommended Legal Workflow', '推荐法律工作流程'],
  ['Platform Notes', '平台注意事项'],
  ['Safety And Evidence Handling', '安全与证据处理']
])

function pageTitleFromFilename(name) {
  return name
    .replace(/-ABL-\d{8}-V\d+\.(md|html)$/, '')
    .replace(/\.(md|html)$/, '')
    .replace(/-/g, ' ')
}

function firstHeading(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.match(/^#\s+(.+)$/)?.[1]?.trim())
    .find(Boolean)
}

function removeLeadingH1(markdown) {
  return markdown.replace(/^#\s+.+\n+/, '')
}

function displayTitle(key, fallbackName, markdown = '') {
  if (titleOverrides.has(key)) return titleOverrides.get(key)
  const heading = firstHeading(stripYamlFrontmatter(markdown))
  if (heading && !/^[a-z0-9._+\-\s/]+$/i.test(heading)) return heading
  return pageTitleFromFilename(fallbackName)
}

function cleanSummaryText(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function summarizeMarkdown(key, markdown) {
  if (summaryOverrides.has(key)) return summaryOverrides.get(key)
  const body = stripYamlFrontmatter(markdown)
  const lines = body.split('\n')
  const candidates = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    if (line.startsWith('---')) continue
    if (line.startsWith('```')) continue
    if (/^<\w+(\s|>|\/>)/.test(line)) continue
    if (line.startsWith('|')) continue
    if (/^来源(仓库|目录)：/.test(line)) continue
    if (/^生成日期：/.test(line)) continue
    if (/^适用对象：/.test(line)) continue
    const cleaned = cleanSummaryText(line.replace(/^[-*]\s+/, '').replace(/^\d+[.、]\s+/, ''))
    if (cleaned.length >= 18) candidates.push(cleaned)
    if (candidates.length >= 2) break
  }
  const summary = candidates.join('；')
  if (!summary) return '汇总该主题下的关键规则、使用场景和操作步骤，便于进入正文前快速判断是否适用。'
  return summary.length > 120 ? `${summary.slice(0, 118)}……` : summary
}

function stripHtmlTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i)
  if (!match) return ''
  return stripHtmlTags(match[1]).replace(/\s*\|\s*李成律师法律AI工作站$/, '').trim()
}

function displayHtmlTitle(key, fallbackName, html = '') {
  if (titleOverrides.has(key)) return titleOverrides.get(key)
  return htmlTitle(html) || pageTitleFromFilename(fallbackName)
}

function summarizeHtml(key, html) {
  if (summaryOverrides.has(key)) return summaryOverrides.get(key)

  const meta = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
  if (meta?.[1]) return cleanSummaryText(stripHtmlTags(meta[1]))

  const bodyText = stripHtmlTags(html)
  return bodyText.length > 120 ? `${bodyText.slice(0, 118)}……` : bodyText || '以 HTML 页面形式呈现该主题内容，适合直接打开阅读或演示。'
}

function htmlHeadingIndex(html) {
  const headings = []
  const pattern = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  for (const match of html.matchAll(pattern)) {
    const text = cleanSummaryText(stripHtmlTags(match[2]))
    if (text && !headings.includes(text)) headings.push(text)
    if (headings.length >= 80) break
  }
  return headings
}

function htmlTutorialWrapper({ title, summary, immersiveUrl, githubUrl, updatedAt, html }) {
  const index = htmlHeadingIndex(html)
  const indexMarkdown = index.length
    ? `## 内容索引\n\n${index.map((item) => `- ${item}`).join('\n')}\n\n`
    : ''
  const body = `# ${title}

${summary}

<p class="immersive-link"><a href="${immersiveUrl}" target="_blank" rel="noreferrer">在新窗口打开沉浸版</a></p>

<iframe class="html-tutorial-frame" src="${immersiveUrl}" title="${escapeHtml(title)}沉浸版" loading="lazy"></iframe>

${indexMarkdown}`
  return withArticleChrome(body, '/tutorials/', githubUrl, updatedAt, immersiveUrl)
}

function pngDimensions(file) {
  try {
    return pngDimensionsFromBuffer(readFileSync(file))
  } catch {
    return null
  }
}

function enrichMarkdownImages(dir) {
  for (const name of readDirSafe(dir)) {
    if (!name.endsWith('.md')) continue
    const file = path.join(dir, name)
    const markdown = readFileSync(file, 'utf8')
    const enriched = markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (match, alt, source) => {
      if (/^(?:https?:|data:)/i.test(source)) return match
      const imageFile = path.resolve(dir, decodeURIComponent(source))
      const dimensions = pngDimensions(imageFile)
      const size = dimensions ? ` width="${dimensions.width}" height="${dimensions.height}"` : ''
      return `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"${size}>`
    })
    if (enriched !== markdown) writeFileSync(file, enriched)
  }
}

function headingText(markdownHeading) {
  return cleanSummaryText(
    markdownHeading
      .replace(/#+$/, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\{#[^}]+}/g, '')
  )
}

function decodeHtmlText(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&ZeroWidthSpace;|&#8203;/g, '')
}

function pageHeadings(markdown, pageLink) {
  const items = []
  let currentSecondLevel = null
  const rendered = markdownRenderer.render(stripYamlFrontmatter(markdown))
  const headingPattern = /<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g

  for (const match of rendered.matchAll(headingPattern)) {
    const level = Number(match[1])
    const id = decodeHtmlText(match[2])
    const originalText = cleanSummaryText(decodeHtmlText(match[3].replace(/<[^>]+>/g, ' ')))
    if (!originalText) continue

    const item = {
      text: headingTitleOverrides.get(originalText) || originalText,
      link: `${pageLink}#${id}`
    }

    if (level === 2) {
      items.push(item)
      currentSecondLevel = item
      continue
    }

    if (currentSecondLevel) {
      currentSecondLevel.items ||= []
      currentSecondLevel.items.push(item)
    } else {
      items.push(item)
    }
  }

  return items
}

function indexCardList(items) {
  return `<div class="index-card-list">
${items
    .map(
      (item) => `  <a class="index-card" href="${item.href}">
    <span class="index-card-title">${escapeHtml(item.title)}</span>
    <span class="index-card-desc">${escapeHtml(item.summary)}</span>
  </a>`
    )
    .join('\n')}
</div>
`
}

function gitText(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function gitLastUpdated(repoDir, relativePath) {
  try {
    const lastCommitDate = gitText(['log', '-1', '--format=%cI', '--', relativePath], repoDir)
    if (lastCommitDate) return lastCommitDate
  } catch {
    // Fall back to the repository head date when a path has no dedicated history.
  }

  try {
    return gitText(['log', '-1', '--format=%cI'], repoDir)
  } catch {
    return new Date().toISOString()
  }
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(isoDate))
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function rssFeed(items) {
  const entries = items.slice(0, 50).map((item) => `  <item>
    <title>${escapeXml(item.title)}</title>
    <link>https://ai.licheng.uk${escapeXml(item.href)}</link>
    <guid>https://ai.licheng.uk${escapeXml(item.href)}</guid>
    <description>${escapeXml(item.summary)}</description>
    <pubDate>${new Date(item.updatedAt).toUTCString()}</pubDate>
  </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>李成律师法律AI工作站</title>
  <link>https://ai.licheng.uk/</link>
  <description>智能体指令、法律业务技能与 AI 工具教程</description>
${entries}
</channel>
</rss>
`
}

function latestArticleList(items) {
  return `<div class="latest-article-list">
${items
    .map(
      (item) => `  <a class="latest-article" href="${item.href}">
    <span class="latest-article-meta">
      <span>${escapeHtml(item.section)}</span>
      <time datetime="${escapeHtml(item.updatedAt)}">更新日期：${escapeHtml(formatDate(item.updatedAt))}</time>
    </span>
    <span class="latest-article-title">${escapeHtml(item.title)}</span>
    <span class="latest-article-desc">${escapeHtml(item.summary)}</span>
  </a>`
    )
    .join('\n')}
</div>
`
}

function buildSectionSidebar({ section, indexText, destDir }) {
  const sidebar = {}

  for (const name of readDirSafe(destDir).sort()) {
    if (!name.endsWith('.md') || name === 'index.md') continue

    const file = path.join(destDir, name)
    const markdown = readFileSync(file, 'utf8')
    const pageName = name.replace(/\.md$/, '')
    const pageLink = `/${section}/${pageName}`
    const key = `${section}/${name}`
    const title = displayTitle(key, name, markdown)
    const headings = pageHeadings(markdown, pageLink)

    sidebar[pageLink] = [
      { text: '返回栏目列表', link: `/${section}/` },
      { text: title, link: pageLink },
      {
        text: '本页目录',
        items: headings.length > 0 ? headings : [{ text: title, link: pageLink }]
      }
    ]
  }

  sidebar[`/${section}/`] = [{ text: indexText, link: `/${section}/` }]

  return sidebar
}

function writeGeneratedSidebar() {
  const sidebar = {
    ...buildSectionSidebar({
      section: 'agents',
      indexText: '智能体通用指令和项目指令',
      destDir: agentsDest
    }),
    ...buildSectionSidebar({
      section: 'skills',
      indexText: '法律业务 Skill 技能',
      destDir: skillsDest
    }),
    ...buildSectionSidebar({
      section: 'tutorials',
      indexText: 'AI 教程',
      destDir: tutorialsDest
    }),
    '/latest/': [{ text: '最新文章', link: '/latest/' }]
  }

  writeFileSync(
    path.join(siteDir, '.vitepress', 'generated-sidebar.mjs'),
    `export const generatedSidebar = ${JSON.stringify(sidebar, null, 2)}\n`
  )
}

rmSync(cacheDir, { recursive: true, force: true })
ensureDir(cacheDir)

for (const source of sources) {
  syncSourceRepo(source)
}

for (const dir of ['agents', 'skills', 'tutorials', 'assets']) {
  rmSync(path.join(siteDir, dir), { recursive: true, force: true })
}
rmSync(path.join(siteDir, 'public', 'tutorials'), { recursive: true, force: true })
rmSync(path.join(siteDir, 'public', 'tutorial-views'), { recursive: true, force: true })

writeFileSync(path.join(siteDir, 'index.md'), `<section class="home-hero">
  <div class="home-hero-copy">
    <p class="home-eyebrow">Legal AI Workspace</p>
    <h1>李成律师法律AI工作站</h1>
    <p class="home-intro">面向中国法律服务场景，集中整理智能体指令、法律业务技能与 AI 工具教程。</p>
    <div class="home-hero-actions">
      <a class="home-primary-link" href="/latest/">查看最新文章</a>
      <a class="home-secondary-link" href="/agents/">进入指令库</a>
    </div>
  </div>
  <aside class="home-hero-panel" aria-label="工作站内容概览">
    <span class="home-panel-label">Workspace index</span>
    <span class="home-panel-title">Prompt · Skill · Tutorial</span>
    <span class="home-panel-desc">把日常法律 AI 工作拆成可搜索、可复制、可追溯来源的页面。</span>
    <span class="home-panel-rule"></span>
    <span class="home-panel-row"><strong>01</strong> 指令库</span>
    <span class="home-panel-row"><strong>02</strong> 技能库</span>
    <span class="home-panel-row"><strong>03</strong> 教程库</span>
  </aside>
</section>

<HomeSearchBox />

<section class="home-grid" aria-label="内容入口">
  <a class="home-card" href="/agents/">
    <span class="home-card-index">01 / Agents</span>
    <span class="home-card-title">智能体通用指令和项目指令共享</span>
    <span class="home-card-desc">沉淀通用 AGENTS 指令、项目约束与法律工作默认规则。</span>
  </a>
  <a class="home-card" href="/skills/">
    <span class="home-card-index">02 / Skills</span>
    <span class="home-card-title">法律业务skill技能共享</span>
    <span class="home-card-desc">汇总合同审查、网络核查、知识产权证据归档等可复用技能。</span>
  </a>
  <a class="home-card" href="/tutorials/">
    <span class="home-card-index">03 / Tutorials</span>
    <span class="home-card-title">AI智能体安装、环境配置、各种技巧等教程</span>
    <span class="home-card-desc">覆盖 Codex 环境搭建、系统依赖、代理配置与日常使用技巧。</span>
  </a>
  <a class="home-card" href="/latest/">
    <span class="home-card-index">04 / Updates</span>
    <span class="home-card-title">最新文章</span>
    <span class="home-card-desc">按更新日期倒序展示已经上传或更新的文章，直接跳转到具体页面。</span>
  </a>
</section>
`)

const latestArticles = []

const agentsSrc = path.join(cacheDir, 'agents')
const agentsDest = path.join(siteDir, 'agents')
ensureDir(agentsDest)
copyMarkdownFiles(agentsSrc, agentsDest)
addArticleChromeToMarkdownFiles(agentsDest, '/agents/', sourceWebUrls.agents, agentsSrc)

let agentsIndex = `${backButton('/')}# 智能体通用指令和项目指令

<p class="section-lead">这里集中展示可复用的智能体通用规则和法律项目指令，适合在开始具体任务前先选择合适的工作规范。</p>

<p class="source-link">来源仓库：<a href="https://github.com/lennonli/licheng-AGENTS.md" target="_blank" rel="noreferrer">lennonli/licheng-AGENTS.md</a></p>

## 文档列表

`
const agentItems = []
for (const name of readDirSafe(agentsDest).sort()) {
  if (!name.endsWith('.md') || name === 'index.md') continue
  const markdown = readFileSync(path.join(agentsDest, name), 'utf8')
  const key = `agents/${name}`
  agentItems.push({
    href: `/agents/${name.replace(/\.md$/, '')}`,
    title: displayTitle(key, name, markdown),
    summary: summarizeMarkdown(key, markdown)
  })
  if (name !== 'README.md') {
    latestArticles.push({
      href: `/agents/${name.replace(/\.md$/, '')}`,
      title: displayTitle(key, name, markdown),
      summary: summarizeMarkdown(key, markdown),
      section: '智能体指令',
      updatedAt: gitLastUpdated(agentsSrc, name)
    })
  }
}
agentsIndex += indexCardList(agentItems)
writeFileSync(path.join(agentsDest, 'index.md'), agentsIndex)

const skillsSrc = path.join(cacheDir, 'skills')
const skillsDest = path.join(siteDir, 'skills')
ensureDir(skillsDest)
const skillDirs = listSkillDirs(skillsSrc)
let skillsIndex = `${backButton('/')}# 法律业务 Skill 技能

<p class="section-lead">这里汇总法律业务中可以复用的 Skill，覆盖证据归档、网络核查和常见实务自动化流程。</p>

<p class="source-link">来源仓库：<a href="https://github.com/lennonli/licheng-skills" target="_blank" rel="noreferrer">lennonli/licheng-skills</a></p>

## Skill 列表

`
const skillItems = []
for (const dir of skillDirs) {
  const skillMd = stripYamlFrontmatter(readFileSync(path.join(skillsSrc, dir, 'SKILL.md'), 'utf8'))
  const skillKey = `skills/${dir}`
  const skillUpdatedAt = gitLastUpdated(skillsSrc, path.join(dir, 'SKILL.md'))
  const page = `${backButton('/skills/')}${articleTools(githubBlobUrl(sourceWebUrls.skills, `${dir}/SKILL.md`), skillUpdatedAt)}# ${displayTitle(skillKey, dir, skillMd)}

来源目录：\`${dir}/SKILL.md\`

${removeLeadingH1(skillMd)}
`
  writeFileSync(path.join(skillsDest, `${dir}.md`), page)
  skillItems.push({
    href: `/skills/${dir}`,
    title: displayTitle(skillKey, dir, skillMd),
    summary: summarizeMarkdown(skillKey, skillMd)
  })
  latestArticles.push({
    href: `/skills/${dir}`,
    title: displayTitle(skillKey, dir, skillMd),
    summary: summarizeMarkdown(skillKey, skillMd),
    section: '法律业务 Skill',
    updatedAt: skillUpdatedAt
  })
}
skillsIndex += indexCardList(skillItems)
writeFileSync(path.join(skillsDest, 'index.md'), skillsIndex)

const tutorialsSrc = path.join(cacheDir, 'tutorials')
const localTutorialsSrc = path.join(root, 'content', 'tutorials')
const tutorialsDest = path.join(siteDir, 'tutorials')
const tutorialViewsDest = path.join(siteDir, 'public', 'tutorial-views')
ensureDir(tutorialsDest)
let tutorialHtmlFiles = []
const tutorialMarkdownSources = new Map()

if (existsSync(path.join(tutorialsSrc, 'docs'))) {
  copyMarkdownFiles(path.join(tutorialsSrc, 'docs'), tutorialsDest)
  tutorialHtmlFiles = copyTutorialHtmlFiles(path.join(tutorialsSrc, 'docs'), tutorialViewsDest)
  addArticleChromeToMarkdownFiles(tutorialsDest, '/tutorials/', sourceWebUrls.tutorials, tutorialsSrc, 'docs')
  for (const name of readDirSafe(path.join(tutorialsSrc, 'docs')).sort()) {
    if (!name.endsWith('.md')) continue
    tutorialMarkdownSources.set(name, {
      repoDir: tutorialsSrc,
      relativePath: path.join('docs', name)
    })
  }
}
if (existsSync(path.join(tutorialsSrc, 'assets'))) {
  cpSync(path.join(tutorialsSrc, 'assets'), path.join(siteDir, 'assets'), { recursive: true })
}
if (existsSync(localTutorialsSrc)) {
  copyMarkdownFiles(localTutorialsSrc, tutorialsDest)
  addArticleChromeToMarkdownFiles(tutorialsDest, '/tutorials/', sourceWebUrls.site, root, 'content/tutorials')
  for (const name of readDirSafe(localTutorialsSrc).sort()) {
    if (!name.endsWith('.md')) continue
    tutorialMarkdownSources.set(name, {
      repoDir: root,
      relativePath: path.join('content', 'tutorials', name)
    })
  }
}

for (const { name, slug } of tutorialHtmlFiles) {
  const sourcePath = path.join('docs', name)
  const html = readFileSync(path.join(tutorialsSrc, sourcePath), 'utf8')
  const key = `tutorials/${name}`
  const title = displayHtmlTitle(key, name, html)
  const summary = summarizeHtml(key, html)
  const updatedAt = gitLastUpdated(tutorialsSrc, sourcePath)
  const immersiveUrl = `/tutorial-views/${slug}/`
  const githubUrl = githubBlobUrl(sourceWebUrls.tutorials, sourcePath)
  const wrapperName = `${slug}.md`
  writeFileSync(
    path.join(tutorialsDest, wrapperName),
    htmlTutorialWrapper({ title, summary, immersiveUrl, githubUrl, updatedAt, html })
  )
  tutorialMarkdownSources.set(wrapperName, { repoDir: tutorialsSrc, relativePath: sourcePath })
}

enrichMarkdownImages(tutorialsDest)

let tutorialsIndex = `${backButton('/')}# AI 教程

<p class="section-lead">这里整理 AI 智能体安装、法律工作流环境配置和日常使用技巧，方便按平台和工具场景快速查找。</p>

<p class="source-link">来源仓库：<a href="https://github.com/lennonli/licheng-AI-tutorials" target="_blank" rel="noreferrer">lennonli/licheng-AI-tutorials</a>；本站补充教程：<a href="https://github.com/lennonli/licheng-ai-site/tree/main/content/tutorials" target="_blank" rel="noreferrer">lennonli/licheng-ai-site</a></p>

## 教程列表

`
const tutorialItems = []
for (const name of readDirSafe(tutorialsDest).sort()) {
  if (!name.endsWith('.md') || name === 'index.md') continue
  const markdown = readFileSync(path.join(tutorialsDest, name), 'utf8')
  const key = `tutorials/${name}`
  const source = tutorialMarkdownSources.get(name) || {
    repoDir: tutorialsSrc,
    relativePath: path.join('docs', name)
  }
  tutorialItems.push({
    href: `/tutorials/${name.replace(/\.md$/, '')}`,
    title: displayTitle(key, name, markdown),
    summary: summarizeMarkdown(key, markdown)
  })
  latestArticles.push({
    href: `/tutorials/${name.replace(/\.md$/, '')}`,
    title: displayTitle(key, name, markdown),
    summary: summarizeMarkdown(key, markdown),
    section: 'AI 教程',
    updatedAt: gitLastUpdated(source.repoDir, source.relativePath)
  })
}
tutorialsIndex += indexCardList(tutorialItems)
writeFileSync(path.join(tutorialsDest, 'index.md'), tutorialsIndex)

latestArticles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

const latestDest = path.join(siteDir, 'latest')
ensureDir(latestDest)
writeFileSync(
  path.join(latestDest, 'index.md'),
  `${backButton('/')}# 最新文章

<p class="section-lead">这里按更新日期从新到旧展示已经上传或更新的文章。文章正文不在本页重复撰写，点击标题即可进入具体页面。</p>

<p class="source-link">本页更新日期：${formatDate(new Date().toISOString())}</p>

${latestArticleList(latestArticles)}
`
)

writeFileSync(path.join(siteDir, 'public', 'feed.xml'), rssFeed(latestArticles))
writeFileSync(
  path.join(siteDir, 'public', 'source-manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), sources: Object.fromEntries(sourceRevisions) }, null, 2)}\n`
)

writeGeneratedSidebar()

console.log('Content synced.')
