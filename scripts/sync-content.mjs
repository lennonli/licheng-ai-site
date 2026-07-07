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

function pageTitleFromFilename(name) {
  return name
    .replace(/-ABL-\d{8}-V\d+\.md$/, '')
    .replace(/\.md$/, '')
    .replace(/-/g, ' ')
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

let agentsIndex = `# AGENTS 指令

来源仓库：<https://github.com/lennonli/licheng-AGENTS.md>

## 文档列表

`
for (const name of readDirSafe(agentsDest).sort()) {
  if (!name.endsWith('.md') || name === 'index.md') continue
  agentsIndex += `- [${pageTitleFromFilename(name)}](/agents/${name.replace(/\.md$/, '')})\n`
}
writeFileSync(path.join(agentsDest, 'index.md'), agentsIndex)

const skillsSrc = path.join(cacheDir, 'skills')
const skillsDest = path.join(siteDir, 'skills')
ensureDir(skillsDest)
const skillDirs = listSkillDirs(skillsSrc)
let skillsIndex = `# Agent Skills

来源仓库：<https://github.com/lennonli/licheng-skills>

## Skill 列表

`
for (const dir of skillDirs) {
  const skillMd = stripYamlFrontmatter(readFileSync(path.join(skillsSrc, dir, 'SKILL.md'), 'utf8'))
  const page = `# ${dir}

来源目录：\`${dir}/SKILL.md\`

${skillMd}
`
  writeFileSync(path.join(skillsDest, `${dir}.md`), page)
  skillsIndex += `- [${dir}](/skills/${dir})\n`
}
writeFileSync(path.join(skillsDest, 'index.md'), skillsIndex)

const tutorialsSrc = path.join(cacheDir, 'tutorials')
const tutorialsDest = path.join(siteDir, 'tutorials')
ensureDir(tutorialsDest)

if (existsSync(path.join(tutorialsSrc, 'docs'))) {
  copyMarkdownFiles(path.join(tutorialsSrc, 'docs'), tutorialsDest)
}
if (existsSync(path.join(tutorialsSrc, 'assets'))) {
  cpSync(path.join(tutorialsSrc, 'assets'), path.join(siteDir, 'assets'), { recursive: true })
}

let tutorialsIndex = `# AI 教程

来源仓库：<https://github.com/lennonli/licheng-AI-tutorials>

## 教程列表

`
for (const name of readDirSafe(tutorialsDest).sort()) {
  if (!name.endsWith('.md') || name === 'index.md') continue
  tutorialsIndex += `- [${pageTitleFromFilename(name)}](/tutorials/${name.replace(/\.md$/, '')})\n`
}
writeFileSync(path.join(tutorialsDest, 'index.md'), tutorialsIndex)

console.log('Content synced.')
