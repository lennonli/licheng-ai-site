import DefaultTheme from 'vitepress/theme'
import BackButton from './BackButton.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BackButton', BackButton)
  }
}
