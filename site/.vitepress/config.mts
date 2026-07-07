import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '李成律师法律AI工作站',
  description: 'Codex、法律工作流、Agent 指令、Skills 与工具教程',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  themeConfig: {
    search: {
      provider: 'local'
    },
    nav: [
      { text: '首页', link: '/' },
      { text: 'AGENTS', link: '/agents/' },
      { text: 'Skills', link: '/skills/' },
      { text: 'AI 教程', link: '/tutorials/' },
      { text: 'GitHub', link: 'https://github.com/lennonli' }
    ],
    sidebar: {
      '/agents/': [
        { text: 'AGENTS 指令', link: '/agents/' }
      ],
      '/skills/': [
        { text: 'Skills 总览', link: '/skills/' }
      ],
      '/tutorials/': [
        { text: 'AI 教程总览', link: '/tutorials/' }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/lennonli' }
    ],
    footer: {
      message: '内容同步自 GitHub 仓库，仅作为工具教程与工作流说明。',
      copyright: 'Copyright © 李成律师'
    }
  }
})
