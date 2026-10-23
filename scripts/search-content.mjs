const CASE_SECTIONS = ['/kb/', '/kb2023/', '/kb2024/', '/kb2025/', '/kb2026/', '/ma2026/', '/ma2025/', '/ma2024/', '/ma2023/', '/refi2025/', '/refi2024/', '/refi2023/', '/refi2026/']

export function renderSearchSource(src, env, md) {
  const pagePath = (env.path || '').replaceAll('\\', '/')
  if (/__analytics-|\/dashboard\//.test(pagePath)) return ''
  if (!CASE_SECTIONS.some((section) => pagePath.includes(section))) {
    return md.render(src.slice(0, 80_000), env)
  }

  const fileName = pagePath.split('/').pop() || ''
  if (fileName === 'index.md' || /年度总结\.md$/.test(fileName)) return md.render(src, env)

  const title = src.match(/^# .+$/m)?.[0] || ''
  const metadata = src.match(/^---\n([\s\S]*?)\n---/)?.[1] || ''
  const overview = src.match(/^## [^\n]*(?:法律问题总览|法律问题汇总|问询概览)[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] || ''
  const headings = (src.match(/^#{2,3} .+$/gm) || []).join('\n\n')

  // One search document per case: retain issue keywords without duplicating
  // the company title and ancestor headings in a document for every heading.
  // This changes only search excerpts; the complete case page is untouched.
  const excerpt = `${metadata.replace(/^[^:]+:/gm, '')}\n\n${overview.slice(0, 3000)}\n\n${headings}`
    .replace(/^#{1,6}\s+/gm, '')
  return md.render(`${title}\n\n${excerpt}`, env)
}
