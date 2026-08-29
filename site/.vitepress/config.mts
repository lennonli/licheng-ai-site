import { defineConfig } from 'vitepress'
import { generatedSidebar } from './generated-sidebar.mjs'

const siteOrigin = 'https://ai.licheng.uk'

function canonicalUrl(page: string) {
  let route = page.replace(/\.md$/, '')
  route = route === 'index' ? '' : route.replace(/\/index$/, '/')
  if (route && !route.startsWith('/')) route = `/${route}`
  return new URL(route || '/', siteOrigin).href
}

function renderSearchSource(src: string, env: { path?: string }, md: { render: (source: string, env: unknown) => string }) {
  if (env.path?.includes('__analytics-licheng-20260708')) return ''
  if (!env.path?.includes('/kb2024/')) return md.render(src, env)

  const fileName = env.path.split('/').pop() || ''
  if (fileName === 'index.md' || fileName === '2024年度总结.md') return md.render(src, env)

  const frontmatter = src.match(/^---\n([\s\S]*?)\n---/)
  const metadata = frontmatter?.[1]
    .split('\n')
    .filter((line) => /^(company|short|code|board|tags):/.test(line.trim()))
    .map((line) => line.replace(/^[^:]+:\s*/, '').replace(/^"|"$/g, '').trim())
    .filter(Boolean)
    .join(' | ')
  const title = src.match(/^# .+$/m)?.[0] || ''
  return md.render(`${title}\n\n${metadata}`, env)
}

export default defineConfig({
  lang: 'zh-CN',
  title: '李成律师法律AI工作站',
  description: '李成律师（上海市锦天城（深圳）律师事务所）法律AI工作站：分享 IPO、北交所上市、尽职调查等资本市场法律业务的 AI 智能体指令、Skills 与工作流教程。',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,
  sitemap: { hostname: siteOrigin },
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
    docFooter: { prev: '上一页', next: '下一页' },
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
      { text: 'AGENTS 指令', link: '/agents/' },
      { text: 'Skill 技能', link: '/skills/' },
      { text: 'AI 教程', link: '/tutorials/' },
      {
        text: '问询案例',
        items: [
          { text: '2026 年度案例库', link: '/kb/' },
          { text: '2025 年度案例库', link: '/kb2025/' },
          { text: '2024 年度案例库', link: '/kb2024/' },
          { text: '2026 年度总结', link: '/kb/2026年度总结' },
          { text: '2025 年度总结', link: '/kb2025/2025年度总结' },
          { text: '2024 年度总结', link: '/kb2024/2024年度总结' }
        ]
      },
      { text: '实用工具', link: '/tools/' },
      { text: 'AI 网站导航', link: '/tools/ai-directory' },
      { text: 'GitHub', link: 'https://github.com/lennonli' }
    ],
    sidebar: generatedSidebar,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/lennonli' }
    ],
    footer: {
      message: '内容同步自 GitHub 仓库，仅作为工具教程与工作流说明。',
      copyright: 'Copyright © 李成律师'
    }
  }
})
