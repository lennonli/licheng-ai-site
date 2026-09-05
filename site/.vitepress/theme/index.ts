import DefaultTheme from 'vitepress/theme'
import { Fragment, h, defineComponent, computed, provide } from 'vue'
import { dataSymbol, useData } from 'vitepress'
import CaseFilter from './CaseFilter.vue'
import ArticleTools from './ArticleTools.vue'
import BackButton from './BackButton.vue'
import BackToTopButton from './BackToTopButton.vue'
import HomeSearchBox from './HomeSearchBox.vue'
import HomePopularPages from './HomePopularPages.vue'
import InstallPrompt from './InstallPrompt.vue'
import WeChatContact from './WeChatContact.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: defineComponent({
    setup() {
      const data = useData()
      provide(dataSymbol, {
        ...data,
        theme: computed(() => ({ ...data.theme.value, sidebar: data.frontmatter.value.pageSidebar || [] }))
      })
      return () => h(DefaultTheme.Layout, null, {
        'doc-before': () => data.frontmatter.value.reading ? h('nav', { class: 'reading-context', 'aria-label': '系列阅读位置' }, [
          h('a', { href: data.frontmatter.value.reading.parent }, data.frontmatter.value.reading.title),
          h('span', `阅读进度 ${data.frontmatter.value.reading.index} / ${data.frontmatter.value.reading.total}`)
        ]) : null,
        'layout-bottom': () => h(Fragment, null, [h(WeChatContact), h(BackToTopButton)])
      })
    }
  }),
  enhanceApp({ app }) {
    app.component('CaseFilter', CaseFilter)
    app.component('ArticleTools', ArticleTools)
    app.component('BackButton', BackButton)
    app.component('HomeSearchBox', HomeSearchBox)
    app.component('HomePopularPages', HomePopularPages)
    app.component('InstallPrompt', InstallPrompt)
  }
}
