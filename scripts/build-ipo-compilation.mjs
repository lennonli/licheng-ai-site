import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const start = '<!-- IPO-COMPILATION:START -->'
const end = '<!-- IPO-COMPILATION:END -->'

export function buildIpoCompilation(root = process.cwd()) {
  const source = path.join(root, 'content/ipo-inquiry-compilation/2026')
  if (!existsSync(path.join(source, 'latest.md'))) return
  const output = path.join(root, 'site/digest/ipo-inquiry')
  const downloads = path.join(root, 'site/public/downloads/ipo-inquiry/2026')
  mkdirSync(output, { recursive: true })
  mkdirSync(downloads, { recursive: true })
  const latest = readFileSync(path.join(source, 'latest.md'), 'utf8')
  const version = latest.match(/版本[：:]\s*(V[\d.]+)/)?.[1] || '待核验'
  const cutoff = latest.match(/统计截止日[：:]\s*([^\n]+)/)?.[1].trim() || '待核验'
  const page = (text) => `---\noutline: false\n---\n\n<BackButton fallback="/digest/ipo-inquiry/" />\n\n${text}`
  writeFileSync(path.join(output, '2026-compilation.md'), page(latest))
  writeFileSync(path.join(downloads, 'latest.md'), latest)
  const versionsDir = path.join(source, 'versions')
  const files = existsSync(versionsDir) ? readdirSync(versionsDir).filter(f => f.endsWith('.md')) : []
  const rows = []
  for (const file of files) {
    const text = readFileSync(path.join(versionsDir, file), 'utf8')
    const v = text.match(/版本[：:]\s*(V[\d.]+)/)?.[1] || file
    const date = text.match(/统计截止日[：:]\s*([^\n]+)/)?.[1].trim() || '待核验'
    writeFileSync(path.join(downloads, file), text)
    rows.push({ v, date, file })
  }
  rows.sort((a, b) => b.v.localeCompare(a.v, 'en', { numeric: true }))
  writeFileSync(path.join(output, '2026-compilation-archive.md'), [
    '# 2026年度审核问询汇编 · 版本归档', '',
    '[返回栏目](/digest/ipo-inquiry/) · [阅读最新版](/digest/ipo-inquiry/2026-compilation) · <a href="/downloads/ipo-inquiry/2026/latest.md" download>下载最新版</a>', '',
    '以下仅列已取得原始文件的历史版本，不将更新日志重建为旧版全文。原文中的初析、待核实事项和历史统计口径均予保留。', '',
    '| 版本 | 统计截止日 | 原始 Markdown |', '|---|---|---|',
    ...rows.map(r => `| ${r.v} | ${r.date} | <a href="/downloads/ipo-inquiry/2026/${r.file}" download>下载</a> |`), '',
    '更早部分对话附件已无法取回，未伪造或补写旧版文件；如后续恢复原始附件，再补入归档。', ''
  ].join('\n'))
  const indexPath = path.join(output, 'index.md')
  let index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '# IPO 法律问询摘要\n'
  const block = `${start}\n## 2026年度上市及挂牌审核问询法律问题汇编\n\n当前版本：**${version}** · 统计截止日：${cutoff}。本汇编与下方每日日报分别维护，原始统计和待核实标记完整保留。\n\n[阅读完整汇编](/digest/ipo-inquiry/2026-compilation) · <a href="/downloads/ipo-inquiry/2026/latest.md" download>下载 Markdown</a> · [历史版本归档](/digest/ipo-inquiry/2026-compilation-archive)\n\n${end}`
  const a = index.indexOf(start), b = index.indexOf(end)
  if (a !== -1 && b >= a) index = index.slice(0, a) + block + index.slice(b + end.length)
  else index = index.replace(/^(# .+)$/m, `$1\n\n${block}`)
  writeFileSync(indexPath, index)
  return { version, cutoff, archives: rows.length }
}
