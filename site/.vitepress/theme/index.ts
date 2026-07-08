import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import AnalyticsDashboard from './AnalyticsDashboard.vue'
import ArticleTools from './ArticleTools.vue'
import BackButton from './BackButton.vue'
import BackToTopButton from './BackToTopButton.vue'
import HomeSearchBox from './HomeSearchBox.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(BackToTopButton)
    })
  },
  enhanceApp({ app }) {
    app.component('AnalyticsDashboard', AnalyticsDashboard)
    app.component('ArticleTools', ArticleTools)
    app.component('BackButton', BackButton)
    app.component('HomeSearchBox', HomeSearchBox)
  }
}
