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

const root = process.cwd()
const cacheDir = path.join(root, '.cache', 'source-repos')
const siteDir = path.join(root, 'site')

const sources = [
  {
    key: 'agents',
    name: 'AGENTS 指令',
    repo: 'https://github.com/lennonli/licheng-AGENTS.md.git'
  },
  {
    key: 'skills',
    name: 'Agent Skills',
    repo: 'https://github.com/lennonli/licheng-skills.git'
  },
  {
    key: 'tutorials',
    name: 'AI 教程',
    repo: 'https://github.com/lennonli/licheng-AI-tutorials.git'
  }
]

function sh(cmd, args, cwd = root) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
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

function backButton(fallback) {
  return `<BackButton fallback="${fallback}" />\n\n`
}

function withBackButton(markdown, fallback) {
  if (markdown.includes('<BackButton ')) return markdown
  if (!markdown.startsWith('---\n')) return `${backButton(fallback)}${markdown}`

  const end = markdown.indexOf('\n---', 4)
  if (end === -1) return `${backButton(fallback)}${markdown}`
  const frontmatterEnd = end + 4
  return `${markdown.slice(0, frontmatterEnd)}\n\n${backButton(fallback)}${markdown.slice(frontmatterEnd).trimStart()}`
}

function addBackButtonsToMarkdownFiles(dir, fallback) {
  for (const name of readDirSafe(dir).sort()) {
    if (!name.endsWith('.md') || name === 'index.md') continue
    const file = path.join(dir, name)
    writeFileSync(file, withBackButton(readFileSync(file, 'utf8'), fallback))
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
  ['agents/法律PPT设计.md', '法律 PPT 设计指令'],
  ['skills/cnipa-patent-evidence-archive', 'CNIPA 专利证据归档'],
  ['skills/cnipa-trademark-evidence-archive', 'CNIPA 商标证据归档'],
  ['skills/network-check-v3', '中国企业网络核查'],
  ['tutorials/macos-codex-legal-workflow-setup-ABL-20260707-V1.md', 'macOS + Codex 法律工作流环境安装教程'],
  ['tutorials/proxy-clash-verge-full-guide-ABL-20260707-V1.md', '代理工具全平台使用教程'],
  ['tutorials/windows-codex-legal-workflow-setup-ABL-20260707-V1.md', 'Windows + Codex 法律工作流环境安装教程']
])

const summaryOverrides = new Map([
  ['agents/README.md', '说明 AGENTS 指令仓库的用途、文件组成、叠加使用建议和维护规则，适合先判断应使用哪一类项目指令。'],
  ['agents/合同审查和起草.md', '规定合同审查、风险分级、缺失条款补充、法律文件起草、修订模式、签署页和版本命名等合同类任务的工作规则。'],
  ['agents/法律PPT设计.md', '规定法律培训、项目汇报和专业服务 PPT 的视觉风格、版式层级、字体字号、信息呈现方式以及既有 PPT 修改边界。'],
  ['agents/法律业务通用指令.md', '沉淀法律工作全局规则，包括默认客户立场、保密要求、法律依据核验、反编造红线、Word 格式、律所署名和交付方式。'],
  ['skills/cnipa-patent-evidence-archive', '用于从 CNIPA 中国及多国专利审查信息查询系统导出专利申请信息、费用信息、发文信息、质押和许可备案等页面证据，并按申请人和专利号整理成本地底稿。'],
  ['skills/cnipa-trademark-evidence-archive', '用于从 CNIPA 商标网上检索系统归档商标详情页和商标流程页，适合商标核查、知识产权尽调和证据留存。'],
  ['skills/network-check-v3', '用于中国企业主体和风险网络核查，批量检索信用、处罚、失信、监管和公开网页信息，并保存可追溯的 PDF 证据文件。'],
  ['tutorials/macos-codex-legal-workflow-setup-ABL-20260707-V1.md', '面向全新 macOS 和刚安装 Codex 的法律工作环境，覆盖 Homebrew、文档处理、PDF/OCR、Python 虚拟环境和 Codex 配置。'],
  ['tutorials/proxy-clash-verge-full-guide-ABL-20260707-V1.md', '覆盖 macOS、Windows、Android 和 iOS 的代理客户端安装、订阅导入、模式选择、验证排错和法律工作中的安全注意事项。'],
  ['tutorials/windows-codex-legal-workflow-setup-ABL-20260707-V1.md', '面向全新 Windows 和刚安装 Codex 的法律工作环境，覆盖 PowerShell、winget、Office/PDF/OCR、WSL2 和法律文档处理依赖。']
])

function pageTitleFromFilename(name) {
  return name
    .replace(/-ABL-\d{8}-V\d+\.md$/, '')
    .replace(/\.md$/, '')
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

rmSync(cacheDir, { recursive: true, force: true })
ensureDir(cacheDir)

for (const source of sources) {
  sh('git', ['clone', '--depth=1', source.repo, path.join(cacheDir, source.key)])
}

for (const dir of ['agents', 'skills', 'tutorials', 'assets']) {
  rmSync(path.join(siteDir, dir), { recursive: true, force: true })
}

writeFileSync(path.join(siteDir, 'index.md'), `<section class="home-hero">
  <p class="home-eyebrow">Legal AI Workspace</p>
  <h1>李成律师法律AI工作站</h1>
  <p class="home-intro">面向中国法律服务场景，集中整理智能体指令、法律业务技能与 AI 工具教程。</p>
</section>

<section class="home-grid" aria-label="内容入口">
  <a class="home-card" href="/agents/">
    <span class="home-card-index">01</span>
    <span class="home-card-title">智能体通用指令和项目指令共享</span>
    <span class="home-card-desc">沉淀通用 AGENTS 指令、项目约束与法律工作默认规则。</span>
  </a>
  <a class="home-card" href="/skills/">
    <span class="home-card-index">02</span>
    <span class="home-card-title">法律业务skill技能共享</span>
    <span class="home-card-desc">汇总合同审查、网络核查、知识产权证据归档等可复用技能。</span>
  </a>
  <a class="home-card" href="/tutorials/">
    <span class="home-card-index">03</span>
    <span class="home-card-title">AI智能体安装、环境配置、各种技巧等教程</span>
    <span class="home-card-desc">覆盖 Codex 环境搭建、系统依赖、代理配置与日常使用技巧。</span>
  </a>
</section>
`)

const agentsSrc = path.join(cacheDir, 'agents')
const agentsDest = path.join(siteDir, 'agents')
ensureDir(agentsDest)
copyMarkdownFiles(agentsSrc, agentsDest)
addBackButtonsToMarkdownFiles(agentsDest, '/agents/')

let agentsIndex = `# 智能体通用指令和项目指令

来源仓库：<https://github.com/lennonli/licheng-AGENTS.md>

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
}
agentsIndex += indexCardList(agentItems)
writeFileSync(path.join(agentsDest, 'index.md'), agentsIndex)

const skillsSrc = path.join(cacheDir, 'skills')
const skillsDest = path.join(siteDir, 'skills')
ensureDir(skillsDest)
const skillDirs = listSkillDirs(skillsSrc)
let skillsIndex = `# 法律业务 Skill 技能

来源仓库：<https://github.com/lennonli/licheng-skills>

## Skill 列表

`
const skillItems = []
for (const dir of skillDirs) {
  const skillMd = stripYamlFrontmatter(readFileSync(path.join(skillsSrc, dir, 'SKILL.md'), 'utf8'))
  const skillKey = `skills/${dir}`
  const page = `${backButton('/skills/')}# ${displayTitle(skillKey, dir, skillMd)}

来源目录：\`${dir}/SKILL.md\`

${removeLeadingH1(skillMd)}
`
  writeFileSync(path.join(skillsDest, `${dir}.md`), page)
  skillItems.push({
    href: `/skills/${dir}`,
    title: displayTitle(skillKey, dir, skillMd),
    summary: summarizeMarkdown(skillKey, skillMd)
  })
}
skillsIndex += indexCardList(skillItems)
writeFileSync(path.join(skillsDest, 'index.md'), skillsIndex)

const tutorialsSrc = path.join(cacheDir, 'tutorials')
const tutorialsDest = path.join(siteDir, 'tutorials')
ensureDir(tutorialsDest)

if (existsSync(path.join(tutorialsSrc, 'docs'))) {
  copyMarkdownFiles(path.join(tutorialsSrc, 'docs'), tutorialsDest)
  addBackButtonsToMarkdownFiles(tutorialsDest, '/tutorials/')
}
if (existsSync(path.join(tutorialsSrc, 'assets'))) {
  cpSync(path.join(tutorialsSrc, 'assets'), path.join(siteDir, 'assets'), { recursive: true })
}

let tutorialsIndex = `# AI 教程

来源仓库：<https://github.com/lennonli/licheng-AI-tutorials>

## 教程列表

`
const tutorialItems = []
for (const name of readDirSafe(tutorialsDest).sort()) {
  if (!name.endsWith('.md') || name === 'index.md') continue
  const markdown = readFileSync(path.join(tutorialsDest, name), 'utf8')
  const key = `tutorials/${name}`
  tutorialItems.push({
    href: `/tutorials/${name.replace(/\.md$/, '')}`,
    title: displayTitle(key, name, markdown),
    summary: summarizeMarkdown(key, markdown)
  })
}
tutorialsIndex += indexCardList(tutorialItems)
writeFileSync(path.join(tutorialsDest, 'index.md'), tutorialsIndex)

console.log('Content synced.')
