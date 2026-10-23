import test from 'node:test'
import assert from 'node:assert/strict'
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

test('case search retains company and issue keywords in one result per page', () => {
  for (const section of ['kb', 'kb2023', 'kb2024', 'kb2025', 'ma2026', 'refi2026']) {
    const html = renderSearchSource(source, { path: `/repo/site/${section}/920000-测试公司.md` }, md)
    assert.equal((html.match(/<h[1-6]\b/g) || []).length, 1, section)
    for (const word of ['920000-测试公司', '股权代持', '劳务派遣整改']) assert.ok(html.includes(word), word)
    assert.ok(!html.includes('仅案例全文中的详细论述'))
  }
})

test('section indexes, annual summaries and training keep their searchable sections', () => {
  for (const page of ['kb/index.md', 'kb/2026年度总结.md', 'training/index.md', 'tutorials/demo.md']) {
    assert.equal(renderSearchSource(source, { path: `/repo/site/${page}` }, md), md.render(source, { path: `/repo/site/${page}` }))
  }
})

test('private pages stay out of search', () => {
  assert.equal(renderSearchSource(source, { path: '/repo/site/dashboard/index.md' }, md), '')
  assert.equal(renderSearchSource(source, { path: '/repo/site/__analytics-private.md' }, md), '')
})
