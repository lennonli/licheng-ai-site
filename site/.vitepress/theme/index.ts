import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import BackButton from './BackButton.vue'
import BackToTopButton from './BackToTopButton.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(BackToTopButton)
    })
  },
  enhanceApp({ app }) {
    app.component('BackButton', BackButton)
  }
}
