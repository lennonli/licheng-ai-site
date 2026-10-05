import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanSummaryText,
  cleanTutorialSlug,
  encodeGitHubPath,
  enrichHtmlImages,
  escapeHtml,
  escapeXml,
  firstHeading,
  formatDate,
  htmlTitle,
  normalizePlainUrls,
  pageTitleFromFilename,
  pngDimensionsFromBuffer,
  removeLeadingH1,
  stripHtmlTags,
  stripYamlFrontmatter,
  tutorialVersionRank,
  withArticleChrome,
  withSeoFrontmatter
} from '../scripts/sync-text.mjs'

test('cleanTutorialSlug strips internal -ABL-date-version suffixes', () => {
  assert.equal(cleanTutorialSlug('proxy-clash-verge-full-guide-ABL-20260707-V2.html'), 'proxy-clash-verge-full-guide')
  assert.equal(cleanTutorialSlug('ai-basics-04-ABL-20260708.md'), 'ai-basics-04')
  assert.equal(cleanTutorialSlug('macos-codex-legal-workflow-setup.md'), 'macos-codex-legal-workflow-setup')
})

test('tutorialVersionRank prefers newer date, then higher version', () => {
  const rank = tutorialVersionRank
  assert.ok(rank('x-ABL-20260709-V1.md') > rank('x-ABL-20260708-V9.md'), 'date dominates version')
  assert.ok(rank('x-ABL-20260709-V2.md') > rank('x-ABL-20260709-V1.md'), 'version breaks same-date ties')
  assert.equal(rank('x-ABL-20260708-V1.md'), 20260708001)
  assert.equal(rank('plain-tutorial.md'), 0)
})

test('article chrome is inserted once, after frontmatter or BackButton', () => {
  const plain = '# 标题\n\n正文'
  const withChrome = withArticleChrome(plain, '/agents/', 'https://example.com/a.md', '2026-08-29T06:00:00.000Z')
  assert.match(withChrome, /^<BackButton fallback="\/agents\/" \/>/)
  assert.match(withChrome, /<ArticleTools github-url="https:\/\/example\.com\/a\.md" updated-at="2026-08-29"/)
  assert.equal(withArticleChrome(withChrome, '/agents/', 'https://example.com/a.md'), withChrome, 'no duplicates')

  const frontmattered = '---\ntitle: demo\n---\n\n# 标题'
  const chromed = withArticleChrome(frontmattered, '/kb/', 'https://example.com/b.md')
  assert.match(chromed, /^---\ntitle: demo\n---\n\n<BackButton/)
  assert.ok(chromed.indexOf('<BackButton') < chromed.indexOf('<ArticleTools'))

  const withBack = '<BackButton fallback="/tutorials/" />\n\n# 教程'
  const backAndTools = withArticleChrome(withBack, '/tutorials/', 'https://example.com/c.md')
  assert.match(backAndTools, /<BackButton[^\n]*\/>\n+<ArticleTools/)
})

test('withSeoFrontmatter creates or extends frontmatter and skips broken documents', () => {
  const bare = '# 正文'
  const created = withSeoFrontmatter(bare, '  多  空白 摘要 ', '2026-08-29T06:00:00.000Z')
  assert.match(created, /^---\ndescription: "多 空白 摘要"\nlastUpdated: /)
  assert.ok(created.endsWith('\n---\n\n# 正文'))

  const existing = '---\ntitle: demo\n---\n\n正文'
  const extended = withSeoFrontmatter(existing, '摘要', '2026-08-29T06:00:00.000Z')
  assert.equal(extended, '---\ntitle: demo\ndescription: "摘要"\nlastUpdated: 2026-08-29T06:00:00.000Z\n---\n\n正文')

  assert.equal(withSeoFrontmatter(existing, '', ''), existing, 'nothing to add returns input')
  assert.equal(withSeoFrontmatter('---\n未闭合\n', '摘要', ''), '---\n未闭合\n', 'unclosed frontmatter untouched')
})

test('summary and title helpers clean markdown noise', () => {
  assert.equal(cleanSummaryText('看 `代码` 和[链接](https://example.com)与 **重点**'), '看 代码 和链接与 重点')
  assert.equal(pageTitleFromFilename('macos-codex-legal-workflow-setup.md'), 'macos codex legal workflow setup')
  assert.equal(firstHeading('前言\n\n# 标题一\n## 次级'), '标题一')
  assert.equal(removeLeadingH1('# 大标题\n\n正文'), '正文')
  assert.equal(stripYamlFrontmatter('---\na: 1\n---\n\n正文'), '正文')
  assert.equal(stripYamlFrontmatter('无 frontmatter'), '无 frontmatter')
})

test('html helpers strip tags and site title suffix', () => {
  assert.equal(htmlTitle('<title>教程A | 李成律师法律AI工作站</title>'), '教程A')
  assert.equal(htmlTitle('<title>无后缀页</title>'), '无后缀页')
  assert.equal(htmlTitle('<p>无 title</p>'), '')
  assert.equal(stripHtmlTags('<script>bad()</script><h1>标题</h1>'), '标题')
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  assert.equal(escapeXml("A&B<C>'"), 'A&amp;B&lt;C&gt;&apos;')
})

test('normalizePlainUrls wraps bare URLs only', () => {
  assert.equal(normalizePlainUrls('见 https://example.com/a_1?q=1。'), '见 <https://example.com/a_1?q=1>。')
  assert.equal(normalizePlainUrls('已包 <https://example.com/x> 不动'), '已包 <https://example.com/x> 不动')
  assert.equal(normalizePlainUrls('[文本](https://example.com/y) 不动'), '[文本](https://example.com/y) 不动')
})

test('PNG dimension parser reads IHDR and rejects junk', () => {
  const png = Buffer.alloc(24)
  png.write('\x89PNG\r\n\x1a\n', 0, 'latin1')
  png.writeUInt32BE(13, 8)
  png.write('IHDR', 12, 'ascii')
  png.writeUInt32BE(640, 16)
  png.writeUInt32BE(360, 20)
  assert.deepEqual(pngDimensionsFromBuffer(png), { width: 640, height: 360 })
  assert.equal(pngDimensionsFromBuffer(png.subarray(0, 16)), null)
  assert.equal(pngDimensionsFromBuffer(Buffer.from('not a png buffer........', 'ascii')), null)
})

test('enrichHtmlImages adds lazy/async and intrinsic sizes for embedded PNGs', () => {
  const png = Buffer.alloc(24)
  png.write('\x89PNG\r\n\x1a\n', 0, 'latin1')
  png.writeUInt32BE(13, 8)
  png.write('IHDR', 12, 'ascii')
  png.writeUInt32BE(64, 16)
  png.writeUInt32BE(32, 20)
  const dataUri = `data:image/png;base64,${png.toString('base64')}`

  const enriched = enrichHtmlImages(`<img src="${dataUri}" alt="图">`)
  assert.match(enriched, / loading="lazy"/)
  assert.match(enriched, / decoding="async"/)
  assert.match(enriched, / width="64"/)
  assert.match(enriched, / height="32"/)

  const untouched = enrichHtmlImages('<img src="a.png" loading="eager" decoding="sync" width="1" height="2">')
  assert.equal(untouched, '<img src="a.png" loading="eager" decoding="sync" width="1" height="2">')
})

test('formatDate renders git timestamps in Asia/Shanghai', () => {
  assert.equal(formatDate('2026-08-29T06:00:00.000Z'), '2026-08-29')
  assert.equal(formatDate('2026-08-29T20:00:00.000Z'), '2026-08-30', 'UTC 深夜已跨到上海次日')
})

test('encodeGitHubPath percent-encodes each path segment', () => {
  assert.equal(encodeGitHubPath('cases/920116-星图测控.md'), 'cases/920116-%E6%98%9F%E5%9B%BE%E6%B5%8B%E6%8E%A7.md')
  assert.equal(encodeGitHubPath('//a//b.md'), 'a/b.md')
})
