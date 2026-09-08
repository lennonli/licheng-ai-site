import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { sanitizePublicText, sanitizePublicTree } from './public-content.mjs'
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
  },
  {
    key: 'kbmono',
    name: 'IPO 问询案例库（2023-2026）',
    repo: 'https://github.com/lennonli/ipo-inquiry-kb.git',
    localRepo: path.resolve(root, '..', '19-IPO问询案例知识库')
  },
  {
    key: 'ma2026',
    name: '并购重组案例 2026',
    repo: 'https://github.com/lennonli/ma-restructuring-kb-2026.git',
    localRepo: path.resolve(root, '..', '25-并购重组案例知识库-2026')
  },
  {
    key: 'ma2025',
    name: '并购重组案例 2025',
    repo: 'https://github.com/lennonli/ma-restructuring-kb-2025.git',
    localRepo: path.resolve(root, '..', '26-并购重组案例知识库-2025')
  },
  {
    key: 'ma2024',
    name: '并购重组案例 2024',
    repo: 'https://github.com/lennonli/ma-restructuring-kb-2024.git',
    localRepo: path.resolve(root, '..', '28-并购重组案例知识库-2024')
  },
  {
    key: 'ma2023',
    name: '并购重组案例 2023',
    repo: 'https://github.com/lennonli/ma-restructuring-kb-2023.git',
    localRepo: path.resolve(root, '..', '27-并购重组案例知识库-2023')
  }
]

// monorepo 中各年度库所在子目录（网站板块 key → monorepo 子目录）
function kbYearCacheSrc(key) {
  const yearDir = key === 'kb' ? '2026' : key.replace(/^kb/, '')
  return path.join(cacheDir, 'kbmono', yearDir)
}

const sourceWebUrls = {
  agents: 'https://github.com/lennonli/licheng-AGENTS.md',
  skills: 'https://github.com/lennonli/licheng-skills',
  tutorials: 'https://github.com/lennonli/licheng-AI-tutorials',
  kb: 'https://github.com/lennonli/ipo-inquiry-kb',
  kb2025: 'https://github.com/lennonli/ipo-inquiry-kb',
  kb2024: 'https://github.com/lennonli/ipo-inquiry-kb',
  kb2023: 'https://github.com/lennonli/ipo-inquiry-kb',
  ma2026: 'https://github.com/lennonli/ma-restructuring-kb-2026',
  ma2025: 'https://github.com/lennonli/ma-restructuring-kb-2025',
  ma2024: 'https://github.com/lennonli/ma-restructuring-kb-2024',
  ma2023: 'https://github.com/lennonli/ma-restructuring-kb-2023',
  refi2025: 'https://github.com/lennonli/ipo-inquiry-kb',
  site: 'https://github.com/lennonli/licheng-ai-site'
}

function sh(cmd, args, cwd = root) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

function syncSourceRepo(source) {
  const dest = path.join(cacheDir, source.key)
  // GH_SOURCE_TOKEN 供 CI 克隆私有源仓库（如 ipo-inquiry-kb）时注入凭证
  const remoteUrl = process.env.GH_SOURCE_TOKEN
    ? source.repo.replace('https://github.com/', `https://x-access-token:${process.env.GH_SOURCE_TOKEN}@github.com/`)
    : source.repo
  if (source.localRepo && existsSync(path.join(source.localRepo, '.git'))) {
    console.log(`Using local source repo for ${source.key}: ${source.localRepo}`)
    sh('git', ['clone', source.localRepo, dest])
  } else {
    sh('git', ['clone', remoteUrl, dest])
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

const tutorialRedirects = []

function cleanTutorialSlug(name) {
  return name.replace(/\.[^.]+$/, '').replace(/-ABL-\d{8}(-V(\d+))?$/, '')
}

function tutorialVersionRank(name) {
  const version = Number(name.match(/-V(\d+)(?=\.[^.]+$)/)?.[1] || 0)
  const date = Number(name.match(/-ABL-(\d{8})(?=-V\d+$|(?=\.[^.]+$))/)?.[1] || 0)
  return date * 1000 + version
}

function copyTutorialHtmlFiles(src, dest) {
  const copied = []
  ensureDir(dest)
  for (const name of readDirSafe(src).sort()) {
    const from = path.join(src, name)
    if (!statSync(from).isFile()) continue
    if (!name.endsWith('.html')) continue

    const slug = cleanTutorialSlug(name)
    if (slug !== name.replace(/\.html$/, '')) {
      tutorialRedirects.push({ from: `/tutorial-views/${name.replace(/\.html$/, '')}/`, to: `/tutorial-views/${slug}/` })
      tutorialRedirects.push({ from: `/tutorials/${name.replace(/\.html$/, '')}`, to: `/tutorials/${slug}` })
    }
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

function writeCopySource(repoDir, relativePath, section, slug) {
  const sourcePath = path.join(repoDir, relativePath)
  if (!existsSync(sourcePath)) {
    console.warn(`Copy source file not found: ${sourcePath}`)
    return ''
  }

  const copyPath = path.join(siteDir, 'public', 'copy', section, `${slug}.md`)
  ensureDir(path.dirname(copyPath))
  writeFileSync(copyPath, sanitizePublicText(readFileSync(sourcePath, 'utf8'), { publicCase: /^kb/.test(section) }))
  return `/copy/${encodeGitHubPath(`${section}/${slug}.md`)}`
}

function githubBlobUrl(repoWebUrl, relativePath) {
  return `${repoWebUrl}/blob/main/${encodeGitHubPath(relativePath)}`
}

function articleTools(githubUrl, updatedAt = '', immersiveUrl = '', copyUrl = '') {
  const updated = updatedAt ? ` updated-at="${formatDate(updatedAt)}"` : ''
  const immersive = immersiveUrl ? ` immersive-url="${immersiveUrl}"` : ''
  const copy = copyUrl ? ` copy-url="${copyUrl}"` : ''
  return `<ArticleTools github-url="${githubUrl}"${updated}${immersive}${copy} />\n\n`
}

function withBackButton(markdown, fallback) {
  if (markdown.includes('<BackButton ')) return markdown
  if (!markdown.startsWith('---\n')) return `${backButton(fallback)}${markdown}`

  const end = markdown.indexOf('\n---', 4)
  if (end === -1) return `${backButton(fallback)}${markdown}`
  const frontmatterEnd = end + 4
  return `${markdown.slice(0, frontmatterEnd)}\n\n${backButton(fallback)}${markdown.slice(frontmatterEnd).trimStart()}`
}

function withArticleTools(markdown, githubUrl, updatedAt = '', immersiveUrl = '', copyUrl = '') {
  if (markdown.includes('<ArticleTools ')) return markdown

  const backButtonMatch = markdown.match(/<BackButton [^\n]+\/>\n*/)
  if (backButtonMatch && backButtonMatch.index !== undefined) {
    const insertAt = backButtonMatch.index + backButtonMatch[0].length
    return `${markdown.slice(0, insertAt)}\n${articleTools(githubUrl, updatedAt, immersiveUrl, copyUrl)}${markdown.slice(insertAt).trimStart()}`
  }

  if (!markdown.startsWith('---\n')) return `${articleTools(githubUrl, updatedAt, immersiveUrl, copyUrl)}${markdown}`

  const end = markdown.indexOf('\n---', 4)
  if (end === -1) return `${articleTools(githubUrl, updatedAt, immersiveUrl, copyUrl)}${markdown}`
  const frontmatterEnd = end + 4
  return `${markdown.slice(0, frontmatterEnd)}\n\n${articleTools(githubUrl, updatedAt, immersiveUrl, copyUrl)}${markdown.slice(frontmatterEnd).trimStart()}`
}

function withArticleChrome(markdown, fallback, githubUrl, updatedAt = '', immersiveUrl = '', copyUrl = '') {
  return withArticleTools(withBackButton(markdown, fallback), githubUrl, updatedAt, immersiveUrl, copyUrl)
}

function withSeoFrontmatter(markdown, description, updatedAt) {
  const lines = []
  const summary = String(description || '').replace(/\s+/g, ' ').trim()
  if (summary) lines.push(`description: ${JSON.stringify(summary)}`)
  if (updatedAt) lines.push(`lastUpdated: ${new Date(updatedAt).toISOString()}`)
  if (!lines.length) return markdown
  if (markdown.startsWith('---\n')) {
    const end = markdown.indexOf('\n---', 4)
    if (end === -1) return markdown
    return `${markdown.slice(0, end + 1)}${lines.join('\n')}\n${markdown.slice(end + 1)}`
  }
  return `---\n${lines.join('\n')}\n---\n\n${markdown}`
}

function addArticleChromeToMarkdownFiles(
  dir,
  fallback,
  repoWebUrl,
  repoDir,
  sourcePrefix = '',
  copyUrlBase = '',
  copySourceDir = repoDir
) {
  const normalizedPrefix = sourcePrefix.replace(/\/+$/, '')
  for (const name of readDirSafe(dir).sort()) {
    if (!name.endsWith('.md') || name === 'index.md') continue
    const file = path.join(dir, name)
    const sourcePath = normalizedPrefix ? `${normalizedPrefix}/${name}` : name
    const copySourcePath = copyUrlBase && normalizedPrefix === 'cases' && !existsSync(path.join(copySourceDir, sourcePath))
      ? `reports/${name}`
      : sourcePath
    const gitSourcePath = /\/kb(?:202[345])?\/$/.test(fallback) ? `${path.basename(repoDir)}/${copySourcePath}` : sourcePath
    const gitRepoDir = /\/kb(?:202[345])?\/$/.test(fallback) ? path.dirname(repoDir) : repoDir
    const updatedAt = gitLastUpdated(gitRepoDir, gitSourcePath)
    const markdown = readFileSync(file, 'utf8')
    const summary = summarizeMarkdown(`${path.basename(dir)}/${name}`, markdown)
    const copyUrl = copyUrlBase
      ? writeCopySource(copySourceDir, copySourcePath, copyUrlBase, name.replace(/\.md$/, ''))
      : ''
    writeFileSync(
      file,
      withArticleChrome(
        withSeoFrontmatter(markdown, summary, updatedAt),
        fallback,
        githubBlobUrl(repoWebUrl, gitSourcePath),
        updatedAt,
        '',
        copyUrl
      )
    )
  }
}

// 不在网站展示的 skill（所内自用工具，仓库保留但不上站）
const siteExcludedSkills = new Set(['company-monitor'])

function listSkillDirs(src) {
  return readDirSafe(src)
    .filter((name) => {
      const full = path.join(src, name)
      return (
        !siteExcludedSkills.has(name) &&
        statSync(full).isDirectory() &&
        existsSync(path.join(full, 'SKILL.md'))
      )
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
  ['skills/company-preliminary-analysis', '委托前公司初步分析报告'],
  ['skills/contract-review', '合同审查'],
  ['skills/network-check-v3', '中国企业网络核查'],
  ['skills/wechat-gzh-format', '公众号文章排版'],
  ['tutorials/macos-codex-legal-workflow-setup.md', 'macOS + Codex 法律工作流环境安装教程'],
  ['tutorials/agent-instruction-tool-selection-training-ABL-20260708-V1.html', '智能体指令体系、工具选择培训讲义（HTML 翻页版）'],
  ['tutorials/proxy-clash-verge-full-guide-ABL-20260707-V2.html', '梯子使用全教程 HTML 自包含版'],
  ['tutorials/windows-codex-legal-workflow-setup.md', 'Windows + Codex 法律工作流环境安装教程']
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
  ['skills/company-preliminary-analysis', '用于在委托建立前为潜在客户出具公司基本情况及法律问题初步分析报告，覆盖竞聘 IPO/挂牌/港股法律顾问、常法客户摸底和股权激励等专项业务前置三类场景。'],
  ['skills/contract-review', '用于合同、协议、订单、承诺函的审查与函件起草，按核心、中等、低风险分级逐条审查并给出可直接替换的修改文本。'],
  ['skills/network-check-v3', '用于中国企业主体和风险网络核查，批量检索信用、处罚、失信、监管和公开网页信息，并保存可追溯的 PDF 证据文件。'],
  ['skills/wechat-gzh-format', '用于将文章内容排版为微信公众号 HTML 模板（法律AI工作站风格），并同步生成 120 字内文章摘要和 2.35:1 封面图，全内联样式一键复制粘贴进公众号编辑器。'],
  ['tutorials/macos-codex-legal-workflow-setup.md', '面向全新 macOS 和刚安装 Codex 的法律工作环境，覆盖 Homebrew、文档处理、PDF/OCR、Python 虚拟环境和 Codex 配置。'],
  ['tutorials/agent-instruction-tool-selection-training-ABL-20260708-V1.html', '面向律师团队的 AI Agent 培训讲义，覆盖大模型与 Agent 区分、指令体系、Codex 工具、Skill/MCP/Plugin、客户秘密保护和团队落地。'],
  ['tutorials/proxy-clash-verge-full-guide-ABL-20260707-V2.html', '代理工具全平台教程的自包含 HTML 版本，适合单文件保存和离线阅读。'],
  ['tutorials/windows-codex-legal-workflow-setup.md', '面向全新 Windows 和刚安装 Codex 的法律工作环境，覆盖 PowerShell、winget、Office/PDF/OCR、WSL2 和法律文档处理依赖。']
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

function htmlToCopyText(html) {
  return html
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(h[1-6]|p|li|tr|div|section|article|header|footer|figure|figcaption|blockquote)>/gi, '\n')
    .replace(/<\/(th|td)>/gi, '\t')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
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

function htmlTutorialWrapper({ title, summary, immersiveUrl, copyUrl, githubUrl, updatedAt, html }) {
  const index = htmlHeadingIndex(html)
  const indexMarkdown = index.length
    ? `## 内容索引\n\n${index.map((item) => `- ${item}`).join('\n')}\n\n`
    : ''
  const body = `# ${title}

${summary}

<p class="immersive-link"><a href="${immersiveUrl}" target="_blank" rel="noreferrer">在新窗口打开沉浸版</a></p>

<iframe class="html-tutorial-frame" src="${immersiveUrl}" title="${escapeHtml(title)}沉浸版" loading="lazy"></iframe>

${indexMarkdown}`
  return withArticleChrome(withSeoFrontmatter(body, summary, updatedAt), '/tutorials/', githubUrl, updatedAt, immersiveUrl, copyUrl)
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

function seriesPresentationCard(presentation) {
  if (!presentation?.href || !presentation?.title || !presentation?.description) return ''
  const kicker = presentation.kicker || '演讲版'
  return `<a class="series-presentation-card" href="${escapeHtml(presentation.href)}" target="_blank" rel="noreferrer">
  <span class="series-presentation-card-glow" aria-hidden="true"></span>
  <span class="series-presentation-card-copy">
    <span class="series-presentation-card-kicker">${escapeHtml(kicker)}</span>
    <span class="series-presentation-card-title">${escapeHtml(presentation.title)}</span>
    <span class="series-presentation-card-desc">${escapeHtml(presentation.description)}</span>
  </span>
  <span class="series-presentation-card-action">打开演讲版 <span aria-hidden="true">↗</span></span>
</a>
`
}

const agentCategoryOrder = [
  '通用工作规则',
  'IPO 尽职调查',
  'IPO 股东出资与调查表',
  '底稿归档与目录'
]

const agentCategoryKeywords = {
  'IPO 股东出资与调查表': ['股东出资', '调查表', '间接股东'],
  '底稿归档与目录': ['工作底稿更新', '非诉业务'],
  '通用工作规则': ['法律业务通用指令', '合同审查', '股改文件', 'PPT']
}

function agentCategoryFor(name) {
  const base = name.replace(/\.md$/, '')
  for (const category of agentCategoryOrder) {
    const keywords = agentCategoryKeywords[category] || []
    if (keywords.some((keyword) => base.includes(keyword))) return category
  }
  return 'IPO 尽职调查'
}

function indexCardListGrouped(groups) {
  return groups
    .map(({ category, items }) => `### ${category}

${indexCardList(items)}`)
    .join('\n\n')
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
  const reading = {}
  for (const entry of seriesEntries) {
    entry.items.forEach((item, index) => {
      if (reading[item.href]) throw new Error(`Article belongs to multiple reading chains: ${item.href}`)
      reading[item.href] = {
        title: entry.title, index: index + 1, total: entry.items.length,
        parent: `/series/${entry.id}/`,
        prev: index ? { text: entry.items[index - 1].title, link: entry.items[index - 1].href } : false,
        next: index + 1 < entry.items.length ? { text: entry.items[index + 1].title, link: entry.items[index + 1].href } : false
      }
    })
  }
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
    ...buildSectionSidebar({
      section: 'kb',
      indexText: 'IPO与挂牌问询案例库·2026',
      destDir: kbDest
    }),
    ...buildSectionSidebar({
      section: 'kb2025',
      indexText: 'IPO与挂牌问询案例库·2025',
      destDir: kb2025Dest
    }),
    ...buildSectionSidebar({
      section: 'ma2026',
      indexText: '并购重组案例库·2026',
      destDir: ma2026Dest
    }),
    ...buildSectionSidebar({
      section: 'ma2025',
      indexText: '并购重组案例库·2025',
      destDir: ma2025Dest
    }),
    ...buildSectionSidebar({
      section: 'ma2024',
      indexText: '并购重组案例库·2024',
      destDir: ma2024Dest
    }),
    ...buildSectionSidebar({
      section: 'ma2023',
      indexText: '并购重组案例库·2023',
      destDir: ma2023Dest
    }),
    ...buildSectionSidebar({
      section: 'refi2025',
      indexText: '再融资案例库·2025',
      destDir: refi2025Dest
    }),
    ...buildSectionSidebar({
      section: 'ma-tutorial',
      indexText: '知识库制作教程',
      destDir: maTutorialDest
    }),
    ...buildSectionSidebar({
      section: 'kb2024',
      indexText: 'IPO与挂牌问询案例库·2024',
      destDir: kb2024Dest
    }),
    ...buildSectionSidebar({
      section: 'kb2023',
      indexText: 'IPO与挂牌问询案例库·2023',
      destDir: kb2023Dest
    }),
    '/latest/': [{ text: '最新文章', link: '/latest/' }],
    '/series/': [
      { text: '系列文章', link: '/series/' },
      ...seriesEntries.map((entry) => ({ text: entry.title, link: `/series/${entry.id}/` }))
    ],
    '/tools/': [
      { text: '实用工具', link: '/tools/' },
      { text: '培训课程表', link: '/tools/legal-tools' },
      { text: '网核网站', link: '/tools/network-check-sites' },
      { text: 'AI 网站导航', link: '/tools/ai-directory' }
    ]
  }

  writeFileSync(
    path.join(siteDir, '.vitepress', 'generated-sidebar.mjs'),
    `export const generatedSidebar = ${JSON.stringify(sidebar, null, 2)}\nexport const generatedReading = ${JSON.stringify(reading, null, 2)}\n`
  )
}

rmSync(cacheDir, { recursive: true, force: true })
ensureDir(cacheDir)

for (const source of sources) {
  syncSourceRepo(source)
}

for (const dir of ['agents', 'skills', 'tutorials', 'kb', 'kb2025', 'ma2026', 'ma2025', 'kb2024', 'kb2023', 'refi2025', 'assets']) {
  rmSync(path.join(siteDir, dir), { recursive: true, force: true })
}
rmSync(path.join(siteDir, 'series'), { recursive: true, force: true })
rmSync(path.join(siteDir, 'public', 'tutorials'), { recursive: true, force: true })
rmSync(path.join(siteDir, 'public', 'tutorial-views'), { recursive: true, force: true })
rmSync(path.join(siteDir, 'public', 'tutorial-copy'), { recursive: true, force: true })
rmSync(path.join(siteDir, 'public', 'copy'), { recursive: true, force: true })
ensureDir(path.join(siteDir, 'public', 'copy'))

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

<HomePopularPages />

<section class="home-grid" aria-label="内容入口">
  <a class="home-card" href="/agents/">
    <span class="home-card-index">01 / Agents</span>
    <span class="home-card-title">智能体指令</span>
    <span class="home-card-desc">沉淀通用 AGENTS 指令、项目约束与法律工作默认规则。</span>
  </a>
  <a class="home-card" href="/skills/">
    <span class="home-card-index">02 / Skills</span>
    <span class="home-card-title">法律业务技能</span>
    <span class="home-card-desc">汇总合同审查、网络核查、知识产权证据归档等可复用技能。</span>
  </a>
  <a class="home-card" href="/tutorials/">
    <span class="home-card-index">03 / Tutorials</span>
    <span class="home-card-title">AI 工具教程</span>
    <span class="home-card-desc">覆盖 Codex 环境搭建、系统依赖、代理配置与日常使用技巧。</span>
  </a>
  <a class="home-card" href="/series/">
    <span class="home-card-index">04 / Series</span>
    <span class="home-card-title">系列文章</span>
    <span class="home-card-desc">同一主题按阅读顺序成系列，从系列目录进入逐篇学习。</span>
  </a>
  <a class="home-card" href="/latest/">
    <span class="home-card-index">05 / Updates</span>
    <span class="home-card-title">最新文章</span>
    <span class="home-card-desc">按更新日期倒序展示已经上传或更新的文章，直接跳转到具体页面。</span>
  </a>
  <a class="home-card" href="/tools/">
    <span class="home-card-index">06 / Tools</span>
    <span class="home-card-title">实用工具</span>
    <span class="home-card-desc">集中整理可直接使用的法律工具和企业网络核查网站。</span>
  </a>
  <a class="home-card" href="/kb/">
    <span class="home-card-index">07 / Cases 2026</span>
    <span class="home-card-title">问询案例库 · 2026年度</span>
    <span class="home-card-desc">2026 年审核问询案例，按问询要点、回复口径与执业提示沉淀。</span>
  </a>
  <a class="home-card" href="/kb2025/">
    <span class="home-card-index">08 / Cases 2025</span>
    <span class="home-card-title">问询案例库 · 2025年度</span>
    <span class="home-card-desc">2025 年审核问询案例，附年度总结报告。</span>
  </a>
  <a class="home-card" href="/ma2026/">
    <span class="home-card-index">09 / MA Cases 2026</span>
    <span class="home-card-title">并购重组案例库 · 2026年度</span>
    <span class="home-card-desc">2026 年注册生效重大资产重组 17 单（发行股份购买资产/重组上市/吸收合并），附交易结构、支付方式、交易金额和问询要点。</span>
  </a>
  <a class="home-card" href="/ma2025/">
    <span class="home-card-index">10 / MA Cases 2025</span>
    <span class="home-card-title">并购重组案例库 · 2025年度</span>
    <span class="home-card-desc">2025 年注册生效重大资产重组 35 单（发行股份购买资产/重组上市/吸收合并），附交易结构、支付方式、交易金额和问询要点。</span>
  </a>
  <a class="home-card" href="/ma2024/">
    <span class="home-card-index">11 / MA Cases 2024</span>
    <span class="home-card-title">并购重组案例库 · 2024年度</span>
    <span class="home-card-desc">2024 年注册生效重大资产重组 11 单（发行股份购买资产/重组上市/吸收合并），附交易结构、支付方式、交易金额和问询要点。</span>
  </a>
  <a class="home-card" href="/ma2023/">
    <span class="home-card-index">12 / MA Cases 2023</span>
    <span class="home-card-title">并购重组案例库 · 2023年度</span>
    <span class="home-card-desc">2023 年注册生效重大资产重组 7 单（发行股份购买资产/重组上市/吸收合并），附交易结构、支付方式、交易金额和问询要点。</span>
  </a>
  <a class="home-card" href="/refi2025/">
    <span class="home-card-index">13 / Refi Cases 2025</span>
    <span class="home-card-title">再融资案例库 · 2025年度</span>
    <span class="home-card-desc">2025 年度深市再融资审核问询案例 76 家（定向增发/可转债，69 家注册生效），覆盖募集资金用途、财务性投资、发行对象与定价等法律要点。</span>
  </a>
  <a class="home-card" href="/kb2024/">
    <span class="home-card-index">14 / Cases 2024</span>
    <span class="home-card-title">问询案例库 · 2024年度</span>
    <span class="home-card-desc">2024 年审核问询案例，附年度总结报告。</span>
  </a>
  <a class="home-card" href="/kb2023/">
    <span class="home-card-index">15 / Cases 2023</span>
    <span class="home-card-title">问询案例库 · 2023年度</span>
    <span class="home-card-desc">2023 年审核问询案例，附年度总结报告。</span>
  </a>
  <a class="home-card" href="/tools/ai-directory">
    <span class="home-card-index">16 / Directory</span>
    <span class="home-card-title">AI 网站导航</span>
    <span class="home-card-desc">30 类精选 AI 官方入口：通用助手、大模型、法律 AI 与权威核验数据源、Agent 与 MCP。</span>
  </a>

</section>
`)

const latestArticles = []

const agentsSrc = path.join(cacheDir, 'agents')
const agentsDest = path.join(siteDir, 'agents')
ensureDir(agentsDest)
copyMarkdownFiles(agentsSrc, agentsDest)
addArticleChromeToMarkdownFiles(agentsDest, '/agents/', sourceWebUrls.agents, agentsSrc, '', 'agents', agentsSrc)

let agentsIndex = `${backButton('/')}# 智能体通用指令和项目指令

<p class="section-lead">这里集中展示可复用的智能体通用规则和法律项目指令，适合在开始具体任务前先选择合适的工作规范。</p>

<p class="source-link">来源仓库：<a href="https://github.com/lennonli/licheng-AGENTS.md" target="_blank" rel="noreferrer">lennonli/licheng-AGENTS.md</a></p>

## 文档列表

`
const agentItems = []
const readmeItem = []
for (const name of readDirSafe(agentsDest).sort()) {
  if (!name.endsWith('.md') || name === 'index.md') continue
  const markdown = readFileSync(path.join(agentsDest, name), 'utf8')
  const key = `agents/${name}`
  const item = {
    href: `/agents/${name.replace(/\.md$/, '')}`,
    title: displayTitle(key, name, markdown),
    summary: summarizeMarkdown(key, markdown),
    updatedAt: gitLastUpdated(agentsSrc, name),
    category: agentCategoryFor(name)
  }
  if (name === 'README.md') {
    readmeItem.push(item)
  } else {
    agentItems.push(item)
    latestArticles.push({
      href: item.href,
      title: item.title,
      summary: item.summary,
      section: '智能体指令',
      updatedAt: item.updatedAt
    })
  }
}

agentsIndex += indexCardList(readmeItem)

const agentGroups = agentCategoryOrder
  .map((category) => ({
    category,
    items: agentItems
      .filter((item) => item.category === category)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }))
  .filter((group) => group.items.length > 0)

agentsIndex += `\n${indexCardListGrouped(agentGroups)}`
writeFileSync(path.join(agentsDest, 'index.md'), agentsIndex)

const skillsSrc = path.join(cacheDir, 'skills')
const skillsDest = path.join(siteDir, 'skills')
ensureDir(skillsDest)
const skillDirs = listSkillDirs(skillsSrc)
let skillsIndex = `${backButton('/')}# 法律业务 Skill 技能

<p class="section-lead">这里汇总法律业务中可以复用的 Skill，覆盖证据归档、网络核查、委托前客户分析、合同审查和常见实务自动化流程。每个 Skill 详情页顶部提供一键安装提示词，复制发给智能体即可完成安装。</p>

<p class="source-link">来源仓库：<a href="https://github.com/lennonli/licheng-skills" target="_blank" rel="noreferrer">lennonli/licheng-skills</a></p>

## Skill 列表

`
const skillItems = []
for (const dir of skillDirs) {
  const skillMd = stripYamlFrontmatter(readFileSync(path.join(skillsSrc, dir, 'SKILL.md'), 'utf8'))
  const skillKey = `skills/${dir}`
  const skillUpdatedAt = gitLastUpdated(skillsSrc, path.join(dir, 'SKILL.md'))
  const copyUrl = writeCopySource(skillsSrc, path.join(dir, 'SKILL.md'), 'skills', dir)
  const page = `${backButton('/skills/')}${articleTools(githubBlobUrl(sourceWebUrls.skills, `${dir}/SKILL.md`), skillUpdatedAt, '', copyUrl)}<InstallPrompt skill-name="${dir}" />

# ${displayTitle(skillKey, dir, skillMd)}

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
const tutorialCopyDest = path.join(siteDir, 'public', 'tutorial-copy')
ensureDir(tutorialsDest)
ensureDir(tutorialCopyDest)
let tutorialHtmlFiles = []
const tutorialMarkdownSources = new Map()

if (existsSync(path.join(tutorialsSrc, 'docs'))) {
  copyMarkdownFiles(path.join(tutorialsSrc, 'docs'), tutorialsDest)
  tutorialHtmlFiles = copyTutorialHtmlFiles(path.join(tutorialsSrc, 'docs'), tutorialViewsDest)
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
  for (const name of readDirSafe(localTutorialsSrc).sort()) {
    if (!name.endsWith('.md')) continue
    tutorialMarkdownSources.set(name, {
      repoDir: root,
      relativePath: path.join('content', 'tutorials', name)
    })
  }
}

// 统一清理教程文件名：去掉 -ABL-日期-V版本 内部后缀；
// 同一基名存在多个版本时仅保留最新（HTML 沉浸版优先于同名 Markdown），旧版记录 301 跳转。
{
  const htmlSlugs = new Set(tutorialHtmlFiles.map((item) => item.slug))
  const groups = new Map()
  const dropped = []
  for (const name of [...tutorialMarkdownSources.keys()].sort()) {
    const slug = cleanTutorialSlug(name)
    if (htmlSlugs.has(slug)) {
      dropped.push(name)
      continue
    }
    const prev = groups.get(slug)
    if (!prev || tutorialVersionRank(name) > tutorialVersionRank(prev)) {
      if (prev) dropped.push(prev)
      groups.set(slug, name)
    } else {
      dropped.push(name)
    }
  }
  for (const name of dropped) {
    rmSync(path.join(tutorialsDest, name), { force: true })
    tutorialRedirects.push({ from: `/tutorials/${name.replace(/\.md$/, '')}`, to: `/tutorials/${cleanTutorialSlug(name)}` })
    tutorialMarkdownSources.delete(name)
  }
  for (const [slug, name] of groups) {
    const target = `${slug}.md`
    if (target === name) continue
    const entry = tutorialMarkdownSources.get(name)
    tutorialMarkdownSources.delete(name)
    renameSync(path.join(tutorialsDest, name), path.join(tutorialsDest, target))
    tutorialRedirects.push({ from: `/tutorials/${name.replace(/\.md$/, '')}`, to: `/tutorials/${slug}` })
    tutorialMarkdownSources.set(target, entry)
  }
  for (const [name, source] of tutorialMarkdownSources) {
    const file = path.join(tutorialsDest, name)
    if (!existsSync(file)) continue
    const repoWebUrl = source.repoDir === root ? sourceWebUrls.site : sourceWebUrls.tutorials
    const updatedAt = gitLastUpdated(source.repoDir, source.relativePath)
    const markdown = readFileSync(file, 'utf8')
    const summary = summarizeMarkdown(`tutorials/${name}`, markdown)
    const copyUrl = writeCopySource(source.repoDir, source.relativePath, 'tutorials', cleanTutorialSlug(name))
    writeFileSync(
      file,
      withArticleChrome(
        withSeoFrontmatter(markdown, summary, updatedAt),
        '/tutorials/',
        githubBlobUrl(repoWebUrl, source.relativePath),
        updatedAt,
        '',
        copyUrl
      )
    )
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
  const copyUrl = `/tutorial-copy/${slug}.txt`
  const githubUrl = githubBlobUrl(sourceWebUrls.tutorials, sourcePath)
  const wrapperName = `${slug}.md`
  writeFileSync(path.join(tutorialCopyDest, `${slug}.txt`), `${htmlToCopyText(html)}\n`)
  writeFileSync(
    path.join(tutorialsDest, wrapperName),
    htmlTutorialWrapper({ title, summary, immersiveUrl, copyUrl, githubUrl, updatedAt, html })
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

// 系列文章页：数据来自 content/series.json，篇目标题与摘要复用 tutorialItems
const seriesConfigPath = path.join(root, 'content', 'series.json')
const seriesConfig = existsSync(seriesConfigPath) ? JSON.parse(readFileSync(seriesConfigPath, 'utf8')) : []
const tutorialItemsBySlug = new Map(
  tutorialItems.map((item) => [item.href.replace('/tutorials/', ''), item])
)
const seriesEntries = []
for (const entry of seriesConfig) {
  if (!entry.id || !/^[a-z0-9-]+$/.test(entry.id)) {
    throw new Error(`series.json: 非法系列 id "${entry.id}"`)
  }
  if (seriesEntries.some((existing) => existing.id === entry.id)) {
    throw new Error(`series.json: 系列 id 重复 "${entry.id}"`)
  }
  if (!entry.title || !entry.description) {
    throw new Error(`series.json: 系列 "${entry.id}" 缺少 title 或 description`)
  }
  const items = (entry.slugs || []).map((slug) => {
    const item = tutorialItemsBySlug.get(slug)
    if (!item) {
      throw new Error(`series.json: 系列 "${entry.id}" 引用了不存在的教程 slug "${slug}"`)
    }
    return item
  })
  if (!items.length) {
    throw new Error(`series.json: 系列 "${entry.id}" 没有任何篇目`)
  }
  seriesEntries.push({ id: entry.id, title: entry.title, description: entry.description, presentation: entry.presentation, items })
}

if (seriesEntries.length) {
  const seriesDest = path.join(siteDir, 'series')
  ensureDir(seriesDest)
  const seriesCards = seriesEntries.map((entry) => ({
    href: `/series/${entry.id}/`,
    title: entry.title,
    summary: `${entry.description}（共 ${entry.items.length} 页（含系列导读））`
  }))
  writeFileSync(
    path.join(seriesDest, 'index.md'),
    `${backButton('/')}# 系列文章

<p class="section-lead">把同一主题的教程按阅读顺序整理成系列，从系列目录进入，按顺序学习。</p>

## 系列列表

${indexCardList(seriesCards)}
`
  )
  for (const entry of seriesEntries) {
    const toc = entry.items
      .map((item, index) => `${index + 1}. [${item.title}](${item.href}) —— ${item.summary.replace(/。；/g, '。')}`)
      .join('\n')
    ensureDir(path.join(seriesDest, entry.id))
    writeFileSync(
      path.join(seriesDest, entry.id, 'index.md'),
      `${backButton('/series/')}# ${escapeHtml(entry.title)}

<p class="section-lead">${escapeHtml(entry.description)}</p>

<p class="source-link">共 ${entry.items.length} 页（含系列导读） · 单篇页面收录于 <a href="/tutorials/">AI 教程</a>栏目 · 来源仓库：<a href="https://github.com/lennonli/licheng-AI-tutorials" target="_blank" rel="noreferrer">lennonli/licheng-AI-tutorials</a></p>

${seriesPresentationCard(entry.presentation)}

## 系列目录

${toc}
`
    )
  }
}

if (tutorialRedirects.length) {
  writeFileSync(
    path.join(siteDir, 'public', '_redirects'),
    `# 旧教程 URL（含 -ABL-日期-版本 内部后缀或已被更新版本取代）301 跳转至清理后地址\n${tutorialRedirects
      .map((item) => `${item.from} ${item.to} 301`)
      .join('\n')}\n`
  )
}

latestArticles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

writeFileSync(
  path.join(siteDir, 'public', 'content-index.json'),
  JSON.stringify(latestArticles.map(({ href, title, summary, section }) => ({ href, title, summary, section })), null, 2)
)

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

// ── IPO 与挂牌审核问询案例库（按年度分库：2026 = /kb/，2025 = /kb2025/）──────
const kbBoardOrder = ['北交所', '科创板', '深市创业板', '沪市主板', '深市主板', '新三板']

function aiTutorialSection(base, repoUrl, exampleCase) {
  const isMa = ['/ma2026', '/ma2025', '/ma2024', '/ma2023'].includes(base)
  const isRefi = base === '/refi2025'
  const libraryType = isRefi ? '上市公司再融资审核问询法律问题案例库' : isMa ? '并购重组审核法律问题案例库' : 'IPO/挂牌审核问询法律问题案例库'
  const exampleTopics = isRefi ? '“财务性投资认定与扣除”与“募集资金用途与补流比例”' : isMa ? '“业绩承诺与补偿”与“支付方式与发股定价”' : '“股权代持”与“特殊投资条款”'
  const institutionLabel = isMa ? '上市公司与' : '发行人与'
  const indexFields = isRefi ? '板块/再融资类型/审核状态/律师' : isMa ? '板块/交易类型/支付方式/律师' : '板块/法律类别/律所'
  const scenario = isRefi
    ? '我在办一个上市公司向特定对象发行股票项目，募集资金部分用于补充流动资金。请从该案例库中找出补流比例、财务性投资扣除或前次募集资金使用的同类案例，总结监管关注要点、回复论证框架和证据清单。'
    : isMa
    ? '我在办一个上市公司重大资产重组项目，请从该案例库中找出交易必要性、支付方式、业绩承诺或关联交易的同类案例，总结监管关注要点、回复论证框架和证据清单。'
    : '我在办一个北交所 IPO 项目，发行人历史上有亲属代持（已还原、无书面代持协议）。请从该案例库的北交所案例中找出同类情形，总结监管关注要点、回复论证框架和证据清单，并指出我需要补充核查的事项。'
  return `## 如何用 AI 智能体使用本案例库

本库是纯 Markdown 公开知识库，任何 AI 智能体都能直接消费。按场景选一种即可。

### 方式一：网页版 AI 直接读案例链接（最简单）

把某篇案例页网址发给支持联网读取的 AI（ChatGPT、Claude、Gemini、豆包、DeepSeek 等），让它定向提取。可直接复制的提示词：

> 请阅读 https://ai.licheng.uk${base}/${exampleCase} 一文，提取其中${exampleTopics}问题的：①问询要点；②${institutionLabel}中介机构的回复论证思路；③执业提示。用表格输出，并单独列出本案证据链构成。

### 方式二：让 AI 检索整个案例库

把检索需求连同库地址一起发给 AI（适合"找同类案例、对比口径"）。提示词模板：

> 这是一个${libraryType}：https://ai.licheng.uk${base}/ （GitHub 源仓库 ${repoUrl} ，含 scripts/index.json 元数据索引，可按${indexFields}筛选）。请查找同一法律问题或交易安排的案例，逐案输出公司、板块、问询要点、回复口径，并对比各案论证差异。

场景化示例：

> ${scenario}

### 方式三：终端智能体本地检索（Claude Code / Codex / ZCode 等）

克隆仓库后让编码代理直接检索全文与索引：

> 在本地 clone 的案例库 cases/ 中检索"未批先建"相关案例，输出每案的问询要点与执业提示；用 scripts/index.json 的 tags 和 board 字段先筛后查，命中案例注明文件名。

### 提示词写法四个要点

1. 给出案例库地址（或本地路径），让 AI 知道去哪读；
2. 写清你的具体情形：板块、问题类型、特殊事实（如"无书面代持协议"），检索越准；
3. 指定输出结构：问询要点 / 回复口径 / 执业提示三段式，或表格对比；
4. 办项目时加一句"请把命中案例的回复与核查要点转成本项目的核查计划和证据清单"，直接产出可执行成果。

注意：案例内容基于公开披露文件提炼，正式援引问询回复口径前请回交易所官网或见微数据核对公告原文。

`
}

function normalizePlainUrls(markdown) {
  return markdown.replace(
    /(?<![<(])https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'*+,;=%-]+/g,
    (url) => `<${url}>`
  )
}

function buildKbYear({ key, base, title, lead, entries, annualFile, annualTitle, sourceDir = null }) {
  const isMa = ['ma2026', 'ma2025', 'ma2024', 'ma2023'].includes(key)
  const dest = path.join(siteDir, key)
  const src = sourceDir || kbYearCacheSrc(key)
  ensureDir(dest)
  copyMarkdownFiles(path.join(src, 'cases'), dest)
  // 年度总结报告页（源仓 reports/ 下单文件）
  const reportsDir = path.join(src, 'reports')
  if (existsSync(reportsDir)) copyMarkdownFiles(reportsDir, dest)
  if (key === 'kb2024') {
    for (const name of readDirSafe(dest).filter((entry) => entry.endsWith('.md'))) {
      const file = path.join(dest, name)
      const markdown = readFileSync(file, 'utf8')
      const normalized = markdown.replace(/（(https?:\/\/[^\s（）<>]+)）/g, '（<$1>）')
      if (normalized !== markdown) writeFileSync(file, normalized)
    }
  }
  if (key === 'kb2023') {
    for (const name of readDirSafe(dest).filter((entry) => entry.endsWith('.md'))) {
      const file = path.join(dest, name)
      const markdown = readFileSync(file, 'utf8')
      const normalized = normalizePlainUrls(markdown)
      if (normalized !== markdown) writeFileSync(file, normalized)
    }
  }
  addArticleChromeToMarkdownFiles(dest, `${base}/`, sourceWebUrls[key], src, 'cases/', key, src)
  // A few legacy case files can contain unusual front matter or line endings
  // that make the normal pass skip them. Keep the article contract explicit:
  // every public case page must expose source, share, and update controls.
  for (const name of readDirSafe(dest).filter((entry) => entry.endsWith('.md') && entry !== 'index.md')) {
    const file = path.join(dest, name)
    const markdown = readFileSync(file, 'utf8')
    if (markdown.includes('<ArticleTools ')) continue
    const sourcePath = existsSync(path.join(src, 'cases', name)) ? `cases/${name}` : `reports/${name}`
    const updatedAt = gitLastUpdated(src, sourcePath)
    const copyUrl = writeCopySource(src, sourcePath, key, name.replace(/\.md$/, ''))
    writeFileSync(file, withArticleChrome(withSeoFrontmatter(markdown, summarizeMarkdown(name, markdown), updatedAt), `${base}/`, githubBlobUrl(sourceWebUrls[key], sourcePath), updatedAt, '', copyUrl))
  }

  const boardGroups = new Map(kbBoardOrder.map((board) => [board, []]))
  for (const entry of entries) {
    const board = boardGroups.has(entry.board) ? entry.board : '其他'
    if (!boardGroups.has(board)) boardGroups.set(board, [])
    boardGroups.get(board).push(entry)
  }

  const sourceLine = `<p class="source-link">来源仓库：${sourceWebUrls[key].replace('https://github.com/', '')}（共 ${entries.length} 份案例）｜<a href="${base}/${annualFile.replace(/\.md$/, '')}">${annualTitle}</a></p>`
  const tutorialExamples = {
    kb: '920079-乔路铭',
    kb2025: '920116-星图测控',
    kb2024: '920002-万达轴承',
    kb2023: '920950-迅安科技',
    ma2026: '000100-TCL科技',
    ma2025: '000561-烽火电子',
    ma2024: '000657-中钨高新',
    ma2023: '688201-北京信安世纪',
    refi2025: '001301-石家庄尚太科'
  }
  const tutorialExample = tutorialExamples[key] || '920002-万达轴承'
  const legacyHead = `${backButton('/')}# ${title}\n\n<p class="section-lead">${lead}</p>\n\n${sourceLine}\n\n${aiTutorialSection(base, sourceWebUrls[key], tutorialExample)}\n\n`

  const yearLinks = isMa
    ? [['ma2026', '2026'], ['ma2025', '2025'], ['ma2024', '2024'], ['ma2023', '2023']]
      .map(([section, year]) => `<a href="/${section}/"${section === key ? ' aria-current="page"' : ''}>并购重组 ${year} 年</a>`).join(' · ')
    : key === 'refi2025'
    ? `<a href="/refi2025/" aria-current="page">再融资 2025 年</a>`
    : [['kb', '2026'], ['kb2025', '2025'], ['kb2024', '2024'], ['kb2023', '2023']]
      .map(([section, year]) => `<a href="/${section}/"${section === key ? ' aria-current="page"' : ''}>${year} 年</a>`).join(' · ')
  let indexMd = `${backButton('/')}# ${title}\n\n<p class="section-lead">${lead}</p>\n\n<nav aria-label="案例库年度">${yearLinks}</nav>\n\n${sourceLine}\n\n[安装知识库技能与 MCP 使用教程](/kbskill/)\n\n<CaseFilter />\n\n<div class="case-directory">\n\n`

  for (const board of [...kbBoardOrder, '其他']) {
    const rows = (boardGroups.get(board) || [])
      .slice()
      .sort((a, b) => {
        const dateField = isMa ? 'registered_date' : 'listing_date'
        return (b[dateField] || '').localeCompare(a[dateField] || '')
      })
    if (!rows.length) continue
    indexMd += `## ${board}（${rows.length}）\n\n`
    indexMd += indexCardList(rows.map((entry) => {
      const dateLabel = isMa
        ? `注册生效 ${entry.registered_date || '待核验'}`
        : (entry.listing_date ? `｜${board === '新三板' ? '挂牌' : '上市'} ${entry.listing_date}` : '')
      const amount = entry.deal_amount === '' || entry.deal_amount == null ? '待核验' : entry.deal_amount
      const summary = key === 'refi2025'
        ? `${entry.refi_type || '再融资'}｜募资上限 ${amount} 万元｜${entry.status_short || '审核状态待核验'}｜${entry.lawyer || '律所未载明'}`
        : isMa
        ? `${entry.lawyer || '律所未载明'}｜${dateLabel}｜${entry.pay_method || '支付方式待核验'}｜交易金额 ${amount} 万元`
        : `${entry.lawyer || '律所未载明'}${dateLabel}｜${(entry.tags || []).slice(0, 6).join(' / ')}`
      return {
        href: `${base}/${entry.file.replace(/\.md$/, '')}`,
        title: `${entry.company}${entry.code ? `（${entry.code}）` : '（在审）'}`,
        summary
      }
    }))
    indexMd += '\n'
  }

  indexMd += '\n</div>\n'
  writeFileSync(path.join(dest, 'index.md'), indexMd)
  return dest
}

// 2026 年度库（/kb/）
const kbSrc = kbYearCacheSrc('kb')
const kbIndexPath = path.join(kbSrc, 'scripts', 'index.json')
const kbEntries = existsSync(kbIndexPath) ? JSON.parse(readFileSync(kbIndexPath, 'utf8')) : []
const kbDest = buildKbYear({
  key: 'kb',
  base: '/kb',
  title: 'IPO与挂牌审核问询案例库 · 2026年度',
  lead: '2026 年上市/挂牌公司审核问询法律问题回溯，一司一文，沉淀"问询要点—回复与核查要点—执业提示"，办理同类项目时可直接检索论证范本与证据链思路。可用站内搜索按公司简称、代码或法律问题关键词检索。',
  entries: kbEntries,
  annualFile: '2026年度总结.md',
  annualTitle: '📊 2026 年度总结报告'
})

// 2025 年度库（/kb2025/）
const kb2025Src = kbYearCacheSrc('kb2025')
const kb2025IndexPath = path.join(kb2025Src, 'scripts', 'index.json')
const kb2025Entries = existsSync(kb2025IndexPath) ? JSON.parse(readFileSync(kb2025IndexPath, 'utf8')) : []
const kb2025Dest = buildKbYear({
  key: 'kb2025',
  base: '/kb2025',
  title: 'IPO与挂牌审核问询案例库 · 2025年度',
  lead: '2025 年上市/挂牌公司审核问询法律问题回溯（A股 116 家 + 新三板 314 家，详述 3,389 个法律问题），一司一文，沉淀"问询要点—回复与核查要点—执业提示"，办理同类项目时可直接检索论证范本与证据链思路。可用站内搜索按公司简称、代码或法律问题关键词检索。',
  entries: kb2025Entries,
  annualFile: '2025年度总结.md',
  annualTitle: '📊 2025 年度总结报告'
})

// 2026 年并购重组年度库（/ma2026/）
const ma2026Src = path.join(cacheDir, 'ma2026')
const ma2026IndexPath = path.join(ma2026Src, 'scripts', 'index.json')
const ma2026Entries = existsSync(ma2026IndexPath) ? JSON.parse(readFileSync(ma2026IndexPath, 'utf8')) : []
const ma2026Dest = buildKbYear({
  key: 'ma2026',
  base: '/ma2026',
  title: '并购重组审核案例库 · 2026年度',
  lead: '2026 年注册生效重大资产重组 17 单（发行股份购买资产/重组上市/吸收合并），一案一文，沉淀交易方案、支付方式、交易金额、问询要点与律师核查结论。可用站内搜索按公司简称、代码、交易类型、支付方式或法律问题关键词检索。',
  entries: ma2026Entries,
  annualFile: '2026年度总结.md',
  annualTitle: '📊 2026 年度总结报告',
  sourceDir: ma2026Src
})

// 2025 年并购重组年度库（/ma2025/）
const ma2025Src = path.join(cacheDir, 'ma2025')
const ma2025IndexPath = path.join(ma2025Src, 'scripts', 'index.json')
const ma2025Entries = existsSync(ma2025IndexPath) ? JSON.parse(readFileSync(ma2025IndexPath, 'utf8')) : []
const ma2025Dest = buildKbYear({
  key: 'ma2025',
  base: '/ma2025',
  title: '并购重组审核案例库 · 2025年度',
  lead: '2025 年注册生效重大资产重组 35 单（发行股份购买资产/重组上市/吸收合并），一案一文，沉淀交易方案、支付方式、交易金额、问询要点与律师核查结论。可用站内搜索按公司简称、代码、交易类型、支付方式或法律问题关键词检索。',
  entries: ma2025Entries,
  annualFile: '2025年度总结.md',
  annualTitle: '📊 2025 年度总结报告',
  sourceDir: ma2025Src
})
const ma2024Src = path.join(cacheDir, 'ma2024')
const ma2024IndexPath = path.join(ma2024Src, 'scripts', 'index.json')
const ma2024Entries = existsSync(ma2024IndexPath) ? JSON.parse(readFileSync(ma2024IndexPath, 'utf8')) : []
const ma2024Dest = buildKbYear({
  key: 'ma2024',
  base: '/ma2024',
  title: '并购重组审核案例库 · 2024年度',
  lead: '2024 年注册生效重大资产重组 11 单（发行股份购买资产/重组上市/吸收合并），一案一文。可用站内搜索按公司简称、代码或法律问题关键词检索。',
  entries: ma2024Entries,
  annualFile: '2024年度总结.md',
  annualTitle: '📊 2024 年度总结报告',
  sourceDir: ma2024Src
})
const ma2023Src = path.join(cacheDir, 'ma2023')
const ma2023IndexPath = path.join(ma2023Src, 'scripts', 'index.json')
const ma2023Entries = existsSync(ma2023IndexPath) ? JSON.parse(readFileSync(ma2023IndexPath, 'utf8')) : []
const ma2023Dest = buildKbYear({
  key: 'ma2023',
  base: '/ma2023',
  title: '并购重组审核案例库 · 2023年度',
  lead: '2023 年注册生效重大资产重组 7 单（发行股份购买资产/重组上市/吸收合并），一案一文。可用站内搜索按公司简称、代码或法律问题关键词检索。',
  entries: ma2023Entries,
  annualFile: '2023年度总结.md',
  annualTitle: '📊 2023 年度总结报告',
  sourceDir: ma2023Src
})

// 2025 年再融资年度库（/refi2025/，源为 ipo-inquiry-kb monorepo 子目录）
const refi2025Src = path.join(cacheDir, 'kbmono', 'refi2025')
const refi2025IndexPath = path.join(refi2025Src, 'scripts', 'index.json')
const refi2025Entries = existsSync(refi2025IndexPath) ? JSON.parse(readFileSync(refi2025IndexPath, 'utf8')) : []
const refi2025Dest = buildKbYear({
  key: 'refi2025',
  base: '/refi2025',
  title: '再融资审核案例库 · 2025年度',
  lead: '2025 年度深市再融资（定向增发/可转债）审核问询案例 76 家（69 家注册生效），一案一文，沉淀募集资金用途、财务性投资、前次募集资金、发行对象与定价等问询要点与律师核查结论。可用站内搜索按公司简称、代码或法律问题关键词检索。',
  entries: refi2025Entries,
  annualFile: '2025年度总结.md',
  annualTitle: '📊 2025 年度总结报告',
  sourceDir: refi2025Src
})

// 教程页
const maTutorialSrc = path.join(cacheDir, 'ma2023')
const maTutorialDest = path.join(siteDir, 'ma-tutorial')
ensureDir(maTutorialDest)


// 2024 年度库（/kb2024/）
const kb2024Src = kbYearCacheSrc('kb2024')
const kb2024IndexPath = path.join(kb2024Src, 'scripts', 'index.json')
const kb2024Entries = existsSync(kb2024IndexPath) ? JSON.parse(readFileSync(kb2024IndexPath, 'utf8')) : []
const kb2024Dest = buildKbYear({
  key: 'kb2024',
  base: '/kb2024',
  title: 'IPO与挂牌审核问询案例库 · 2024年度',
  lead: '2024 年上市/挂牌公司审核问询法律问题回溯（A股 100 家 + 新三板 286 家，详述 1,747 个法律问题），一司一文，沉淀"问询要点—回复与核查要点—执业提示"，办理同类项目时可直接检索论证范本与证据链思路。可用站内搜索按公司简称、代码或法律问题关键词检索。',
  entries: kb2024Entries,
  annualFile: '2024年度总结.md',
  annualTitle: '📊 2024 年度总结报告'
})

// 2023 年度库（/kb2023/）
const kb2023Src = kbYearCacheSrc('kb2023')
const kb2023IndexPath = path.join(kb2023Src, 'scripts', 'index.json')
const kb2023Entries = existsSync(kb2023IndexPath) ? JSON.parse(readFileSync(kb2023IndexPath, 'utf8')) : []
const kb2023Dest = buildKbYear({
  key: 'kb2023',
  base: '/kb2023',
  title: 'IPO与挂牌审核问询案例库 · 2023年度',
  lead: '2023 年上市/挂牌公司审核问询法律问题回溯（A股 313 家 + 新三板 257 家，详述 3,915 个法律问题），一司一文，沉淀"问询要点—回复与核查要点—执业提示"，办理同类项目时可直接检索论证范本与证据链思路。可用站内搜索按公司简称、代码或法律问题关键词检索。',
  entries: kb2023Entries,
  annualFile: '2023年度总结.md',
  annualTitle: '📊 2023 年度总结报告'
})

writeFileSync(path.join(siteDir, 'public', 'feed.xml'), rssFeed(latestArticles))
writeFileSync(
  path.join(siteDir, 'public', 'source-manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), sources: Object.fromEntries(sourceRevisions) }, null, 2)}\n`
)

console.log(`Public content sanitised: ${sanitizePublicTree(siteDir)} files`)
writeGeneratedSidebar()

console.log('Content synced.')
