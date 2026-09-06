import { defineConfig } from 'vitepress'
import { generatedSidebar, generatedReading } from './generated-sidebar.mjs'

const siteOrigin = 'https://ai.licheng.uk'

function canonicalUrl(page: string) {
  let route = page.replace(/\.md$/, '')
  route = route === 'index' ? '' : route.replace(/\/index$/, '/')
  if (route && !route.startsWith('/')) route = `/${route}`
  return new URL(route || '/', siteOrigin).href
}

const KB_CASE_SECTIONS = ['/kb/', '/kb2023/', '/kb2024/', '/kb2025/', '/ma2026/', '/ma2025/']

function renderSearchSource(src: string, env: { path?: string }, md: { render: (source: string, env: unknown) => string }) {
  if (/__analytics-|\/dashboard\//.test(env.path || '')) return ''
  const pagePath = env.path ?? ''
  const isKbCasePage = KB_CASE_SECTIONS.some((section) => pagePath.includes(section))
  if (!isKbCasePage) return md.render(src, env)

  const fileName = pagePath.split('/').pop() || ''
  if (fileName === 'index.md' || /年度总结\.md$/.test(fileName)) return md.render(src, env)

  // Index the metadata and legal issue overview, not only company names.
  const title = src.match(/^# .+$/m)?.[0] || ''
  const metadata = src.match(/^---\n([\s\S]*?)\n---/)?.[1] || ''
  const overview = src.match(/^## [^\n]*(?:法律问题总览|法律问题汇总|问询概览)[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] || ''
  const headings = (src.match(/^#{2,4} .+$/gm) || []).join('\n\n')
  return md.render(`${title}\n\n${metadata.replace(/^[^:]+:/gm, '')}\n\n${overview.slice(0, 14000)}\n\n${headings}`, env)
}

export default defineConfig({
  vite: { server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] } },
  lang: 'zh-CN',
  title: '李成律师法律AI工作站',
  description: '李成律师（上海市锦天城（深圳）律师事务所）法律AI工作站：分享 IPO、北交所上市、尽职调查等资本市场法律业务的 AI 智能体指令、Skills 与工作流教程。',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,
  srcExclude: ['public/copy/**'],
  sitemap: {
    hostname: siteOrigin,
    transformItems: (items) => items.filter((item) => !/__analytics-|dashboard|404/.test(item.url))
  },
  transformPageData(pageData) {
    const route = '/' + pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '')
    const section = '/' + pageData.relativePath.split('/')[0] + '/'
    // Keep each page's outline in its own chunk, never serialise every page into @siteData.
    pageData.frontmatter.pageSidebar = generatedSidebar[route] || generatedSidebar[section] || []
    const reading = generatedReading[route]
    pageData.frontmatter.prev = reading?.prev || false
    pageData.frontmatter.next = reading?.next || false
    if (reading) {
      pageData.frontmatter.reading = reading
      pageData.frontmatter.pageSidebar = [
        { text: reading.title, link: reading.parent },
        ...pageData.frontmatter.pageSidebar.slice(1)
      ]
    }
    if (route === '/') pageData.frontmatter.lastUpdated = false
  },
  transformHead({ page, title, description }) {
    const canonical = canonicalUrl(page)
    const pageDescription = description || `${title}—李成律师法律AI工作站内容页面。`
    return [
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:type', content: 'article' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: pageDescription }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: pageDescription }],
      ['script', { type: 'application/ld+json' }, JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description: pageDescription,
        url: canonical,
        author: { '@type': 'Person', name: '李成律师' },
        publisher: { '@type': 'Organization', name: '上海市锦天城（深圳）律师事务所' }
      })]
    ]
  },
  head: [
    ['script', {}, `try{var k='vitepress-theme-appearance';if(!localStorage.getItem(k)){localStorage.setItem(k,'light');document.documentElement.classList.remove('dark')}}catch(e){}`],
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['script', { src: '/fix-wechat-title.js' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'google-site-verification', content: 'BNCuusVXcvvzeBJVuT-kH8UNI0BpSaL7telWKvCz9ag' }],
    ['meta', { property: 'og:image', content: 'https://ai.licheng.uk/og-image.jpg' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: 'https://ai.licheng.uk/og-image.jpg' }],
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: '李成律师法律AI工作站', href: '/feed.xml' }]
  ],
  themeConfig: {
    logo: { src: '/logo.svg', alt: '李成律师法律AI工作站' },
    aside: false,
    outline: false,
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换至浅色主题',
    darkModeSwitchTitle: '切换至深色主题',
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '更新日期' },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            displayDetails: '显示详细结果',
            resetButtonTitle: '清空搜索',
            backButtonTitle: '关闭搜索',
            noResultsText: '未找到结果：',
            footer: {
              selectText: '选择',
              selectKeyAriaLabel: '回车键',
              navigateText: '切换结果',
              navigateUpKeyAriaLabel: '向上键',
              navigateDownKeyAriaLabel: '向下键',
              closeText: '关闭',
              closeKeyAriaLabel: 'Esc 键'
            }
          }
        },
        _render(src, env, md) {
          return renderSearchSource(src, env, md)
        }
      }
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '最新文章', link: '/latest/' },
      { text: '系列文章', link: '/series/' },
      { text: '指令与技能', items: [
        { text: 'AGENTS 指令', link: '/agents/' },
        { text: '法律业务技能', link: '/skills/' },
        { text: 'AI 工具教程', link: '/tutorials/' }
      ] },
      { text: '法律知识库', items: [
        { text: '2026 年案例库', link: '/kb/' },
        { text: '2025 年案例库', link: '/kb2025/' },
        { text: '2024 年案例库', link: '/kb2024/' },
        { text: '2023 年案例库', link: '/kb2023/' },
        { text: '知识库使用教程', link: '/kbskill/' }
      ] },
      { text: '并购重组案例', items: [
        { text: '2026 年度案例库', link: '/ma2026/' },
        { text: '2026 年度总结', link: '/ma2026/2026年度总结' },
        { text: '2025 年度案例库', link: '/ma2025/' },
        { text: '2025 年度总结', link: '/ma2025/2025年度总结' }
      ] },
      { text: '实用工具', items: [
        { text: '工具总览', link: '/tools/' },
        { text: 'AI 网站导航', link: '/tools/ai-directory' },
        { text: '企业网核网站', link: '/tools/network-check-sites' }
      ] }
    ],
    sidebar: {},
    socialLinks: [
      { icon: 'github', link: 'https://github.com/lennonli' }
    ],
    footer: {
      message: '内容同步自 GitHub 仓库，仅作为工具教程与工作流说明。',
      copyright: 'Copyright © 李成律师'
    }
  }
})
