const CASE_SECTION = /^(?:kb(?:\d{4})?|ma\d{4}|refi\d{4})\//

function plainText(html) {
  return html
    .replace(/<(script|style|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<a\b[^>]*class="header-anchor"[^>]*>[\s\S]*?<\/a>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:#\d+|#x[\da-f]+|\w+);/gi, ' ')
    .replace(/\s+/g, ' ').trim()
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderSearchSource(src, env, md) {
  const pagePath = (env.relativePath || env.path || '')
    .replaceAll('\\', '/')
    .replace(/^.*\/site\//, '')
    .replace(/^\/+/, '')
  if (/__analytics-|^dashboard\//.test(pagePath)) return ''
  if (CASE_SECTION.test(pagePath)) {
    // Keep library entry points discoverable without shipping thousands of
    // cases, annual reports, or company-directory cards to every search user.
    if (!/^[^/]+\/index\.md$/.test(pagePath)) return ''
    const title = src.match(/^# .+$/m)?.[0] || '# 案例库'
    const lead = src.match(/<p class="section-lead">([\s\S]*?)<\/p>/)?.[1] || ''
    return md.render(`${title}\n\n${lead.slice(0, 800)}`, env)
  }

  const html = md.render(src.slice(0, 80_000), env)
  if (env.frontmatter?.search === false) return ''
  // One compact discovery result per article. Keep section keywords even when
  // their full text is beyond the summary, without indexing long code samples.
  const heading = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0]
  if (!heading) return ''
  const sections = [...html.matchAll(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map((match) => plainText(match[2])).join('\n')
  const courseNames = [...html.matchAll(/<p\b[^>]*class="lc-course-name"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((match) => plainText(match[1])).join('\n')
  const summary = plainText(html).slice(0, 800)
  const description = String(env.frontmatter?.description || '').slice(0, 300)
  const searchableHeading = /<a\b[^>]*href="#/.test(heading)
    ? heading
    : heading.replace('</h1>', '<a href="#"></a></h1>')
  return `${searchableHeading}\n<p>${escapeHtml(`${description}\n${sections}\n${courseNames}\n${summary}`)}</p>`
}
