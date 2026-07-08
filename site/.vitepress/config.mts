import { defineConfig } from 'vitepress'
import { generatedSidebar } from './generated-sidebar.mjs'

export default defineConfig({
  lang: 'zh-CN',
  title: '李成律师法律AI工作站',
  description: 'Codex、法律工作流、Agent 指令、Skills 与工具教程',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { property: 'og:title', content: '李成律师法律AI工作站' }],
    ['meta', { property: 'og:description', content: '智能体指令、法律业务技能与 AI 工具教程。' }],
    ['meta', { property: 'og:image', content: 'https://ai.licheng.uk/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: 'https://ai.licheng.uk/og-image.png' }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    aside: false,
    outline: false,
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    search: {
      provider: 'local',
      options: {
        _render(src, env, md) {
          if (env.path?.includes('__analytics-licheng-20260708')) return ''
          return md.render(src, env)
        }
      }
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '最新文章', link: '/latest/' },
      { text: 'AGENTS 指令', link: '/agents/' },
      { text: 'Skill 技能', link: '/skills/' },
      { text: 'AI 教程', link: '/tutorials/' },
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
