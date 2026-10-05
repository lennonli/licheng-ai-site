// sync-content.mjs 的纯文本处理函数集合。
// 单独成模块便于 node:test 单元测试（sync-content.mjs 顶层会克隆源仓库，无法直接导入）。
// 这里的函数必须保持无副作用、不依赖模块级状态。

// 教程文件名统一清理：去掉 -ABL-日期-V版本 内部后缀
export function cleanTutorialSlug(name) {
  return name.replace(/\.[^.]+$/, '').replace(/-ABL-\d{8}(-V(\d+))?$/, '')
}

// 同名教程多版本排序：日期为主、版本号为次，数值越大越新。
// 注意日期后可跟 -V版本 或直接跟扩展名，两种都要能匹配（lookahead 只看当前位置）。
export function tutorialVersionRank(name) {
  const version = Number(name.match(/-V(\d+)(?=\.[^.]+$)/)?.[1] || 0)
  const date = Number(name.match(/-ABL-(\d{8})(?=(?:-V\d+)?\.[^.]+$)/)?.[1] || 0)
  return date * 1000 + version
}

export function pageTitleFromFilename(name) {
  return name
    .replace(/-ABL-\d{8}-V\d+\.(md|html)$/, '')
    .replace(/\.(md|html)$/, '')
    .replace(/-/g, ' ')
}

export function firstHeading(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.match(/^#\s+(.+)$/)?.[1]?.trim())
    .find(Boolean)
}

export function removeLeadingH1(markdown) {
  return markdown.replace(/^#\s+.+\n+/, '')
}

export function stripYamlFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return markdown
  const end = markdown.indexOf('\n---', 4)
  if (end === -1) return markdown
  return markdown.slice(end + 4).trimStart()
}

export function cleanSummaryText(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function stripHtmlTags(html) {
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

export function htmlToCopyText(html) {
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

export function htmlTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i)
  if (!match) return ''
  return stripHtmlTags(match[1]).replace(/\s*\|\s*李成律师法律AI工作站$/, '').trim()
}

export function decodeHtmlText(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&ZeroWidthSpace;|&#8203;/g, '')
}

// 只把"裸链接"包上 <…>；已被 <> 包裹或处于 Markdown 链接/HTML 属性中的 URL 不动
export function normalizePlainUrls(markdown) {
  return markdown.replace(
    /(?<![<(])https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'*+,;=%-]+/g,
    (url) => `<${url}>`
  )
}

export function pngDimensionsFromBuffer(data) {
  if (data.length < 24 || data.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

// 给 HTML 里的 <img> 补 lazy/async 属性；内嵌 base64 PNG 尽量补上原始宽高，
// 避免页面加载时布局抖动（CLS）。
export function enrichHtmlImages(html) {
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

export function encodeGitHubPath(relativePath) {
  return relativePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')
}

export function backButton(fallback) {
  return `<BackButton fallback="${fallback}" />\n\n`
}

// git 提交时间转上海时区 YYYY-MM-DD，供页面"更新日期"展示
export function formatDate(isoDate) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(isoDate))
}

export function articleTools(githubUrl, updatedAt = '', immersiveUrl = '', copyUrl = '') {
  const updated = updatedAt ? ` updated-at="${formatDate(updatedAt)}"` : ''
  const immersive = immersiveUrl ? ` immersive-url="${immersiveUrl}"` : ''
  const copy = copyUrl ? ` copy-url="${copyUrl}"` : ''
  return `<ArticleTools github-url="${githubUrl}"${updated}${immersive}${copy} />\n\n`
}

// 已带 <BackButton> 的文档原样返回；否则插到 frontmatter 之后（无 frontmatter 则插到文首）
export function withBackButton(markdown, fallback) {
  if (markdown.includes('<BackButton ')) return markdown
  if (!markdown.startsWith('---\n')) return `${backButton(fallback)}${markdown}`

  const end = markdown.indexOf('\n---', 4)
  if (end === -1) return `${backButton(fallback)}${markdown}`
  const frontmatterEnd = end + 4
  return `${markdown.slice(0, frontmatterEnd)}\n\n${backButton(fallback)}${markdown.slice(frontmatterEnd).trimStart()}`
}

// 已带 <ArticleTools> 的文档原样返回；否则优先插在 <BackButton> 之后，再退回到 frontmatter 之后
export function withArticleTools(markdown, githubUrl, updatedAt = '', immersiveUrl = '', copyUrl = '') {
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

export function withArticleChrome(markdown, fallback, githubUrl, updatedAt = '', immersiveUrl = '', copyUrl = '') {
  return withArticleTools(withBackButton(markdown, fallback), githubUrl, updatedAt, immersiveUrl, copyUrl)
}

// 注入 SEO 所需的 description / lastUpdated：无 frontmatter 则新建，有则插入到既有 frontmatter 末尾。
// frontmatter 没有闭合 "---" 时视为异常文档，原样返回不注入。
export function withSeoFrontmatter(markdown, description, updatedAt) {
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

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
