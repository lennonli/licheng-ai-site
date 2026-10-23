import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMarkdownRenderer } from 'vitepress'
import { renderSearchSource } from '../scripts/search-content.mjs'

const md = await createMarkdownRenderer(process.cwd())
const source = `---
description: 测试公司审核问询
---
# 920000-测试公司

## 法律问题总览

| 问题 | 内容 |
| --- | --- |
| 股权代持 | 清理及核查 |

## 法律问题详述

### 一、劳务派遣整改

仅案例全文中的详细论述。
`

test('cases and annual reports never enter global search, including future years', () => {
  for (const section of ['kb', 'kb2023', 'kb2024', 'kb2025', 'kb2026', 'ma2023', 'ma2024', 'ma2025', 'ma2026', 'refi2023', 'refi2024', 'refi2025', 'refi2026', 'kb2027', 'ma2027']) {
    for (const file of ['920000-测试公司.md', '2026年度总结.md']) {
      assert.equal(renderSearchSource(source, { path: `/repo/site/${section}/${file}` }, md), '', `${section}/${file}`)
    }
  }
})

test('library entry points are searchable without their company directories', () => {
  const directory = '# IPO与挂牌审核问询案例库 · 2026年度\n\n<p class="section-lead">本年度案例库</p>\n\n## 北交所\n\n目录独有公司名称'
  const html = renderSearchSource(directory, { relativePath: 'kb/index.md' }, md)
  assert.ok(html.includes('IPO与挂牌审核问询案例库'))
  assert.ok(html.includes('本年度案例库'))
  assert.ok(!html.includes('目录独有公司名称'))
})

test('training, instructions, skills and tutorials keep their searchable content', () => {
  for (const page of ['training/index.md', 'tutorials/demo.md', 'agents/demo.md', 'skills/ipo-kb.md', 'kbskill/index.md']) {
    const html = renderSearchSource(source, { path: `/repo/site/${page}` }, md)
    assert.equal((html.match(/<h[1-6]\b/g) || []).length, 1, page)
    for (const text of ['测试公司', '股权代持', '劳务派遣整改', '仅案例全文中的详细论述']) assert.ok(html.includes(text), text)
  }
})

test('relative and Windows paths apply the same archive exclusion', () => {
  assert.equal(renderSearchSource(source, { relativePath: 'kb2025/company.md', path: '/other/project' }, md), '')
  assert.equal(renderSearchSource(source, { path: 'C:\\repo\\site\\refi2026\\company.md' }, md), '')
})

test('compact summaries retain later section keywords without shipping long examples', () => {
  const src = '# 教程\n\n开头摘要\n\n' + '正文内容'.repeat(1000) + '\n\n## 后续章节关键词\n\n```js\nconst CODE_ONLY_TOKEN = true\n```'
  const html = renderSearchSource(src, { relativePath: 'tutorials/long.md' }, md)
  assert.ok(html.includes('开头摘要'))
  assert.ok(html.includes('后续章节关键词'))
  assert.ok(!html.includes('CODE_ONLY_TOKEN'))
  assert.ok(html.length < 4000)
})

test('private pages stay out of search', () => {
  assert.equal(renderSearchSource(source, { path: '/repo/site/dashboard/index.md' }, md), '')
  assert.equal(renderSearchSource(source, { path: '/repo/site/__analytics-private.md' }, md), '')
  assert.equal(renderSearchSource('---\nsearch: false\n---\n\n# Hidden\n\nText', { relativePath: 'tools/hidden.md' }, md), '')
})

test('the standalone training overview exposes an anchored search section', () => {
  const source = readFileSync(new URL('../site/training/index.md', import.meta.url), 'utf8')
  const html = renderSearchSource(source, { path: '/repo/site/training/index.md' }, md)
  assert.match(html, /<h1\b[^>]*id="training-program"[^>]*>法律业务 AI 培训课程表[^<]*<a[^>]*href="#training-program"/)
  assert.ok(html.includes('合同审查、起草修订与 OA 流程自动审查'))
  assert.ok(html.includes('邮件自动化 Skill'))
})
