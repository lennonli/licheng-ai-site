import { defineConfig } from 'vitepress'
import { generatedSidebar } from './generated-sidebar.mjs'

export default defineConfig({
  lang: 'zh-CN',
  title: '李成律师法律AI工作站',
  description: 'Codex、法律工作流、Agent 指令、Skills 与工具教程',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  themeConfig: {
    aside: false,
    outline: false,
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    search: {
      provider: 'local'
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
