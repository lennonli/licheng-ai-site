import DefaultTheme from 'vitepress/theme'
import { Fragment, h } from 'vue'
import ArticleTools from './ArticleTools.vue'
import BackButton from './BackButton.vue'
import BackToTopButton from './BackToTopButton.vue'
import HomeSearchBox from './HomeSearchBox.vue'
import WeChatContact from './WeChatContact.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(Fragment, null, [h(WeChatContact), h(BackToTopButton)])
    })
  },
  enhanceApp({ app }) {
    app.component('ArticleTools', ArticleTools)
    app.component('BackButton', BackButton)
    app.component('HomeSearchBox', HomeSearchBox)
  }
}
