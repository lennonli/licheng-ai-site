<template>
  <section class="article-tools" aria-label="文章工具">
    <button class="article-tool-button" type="button" @click="copyArticle">
      <span class="article-tool-icon" aria-hidden="true">⧉</span>
      <span>{{ copyLabel }}</span>
    </button>
    <a class="article-tool-link" :href="githubUrl" target="_blank" rel="noreferrer">
      <span class="article-tool-icon" aria-hidden="true">↗</span>
      <span>查看 GitHub 源文件</span>
    </a>
    <p class="article-source-url">
      源文件：<a :href="githubUrl" target="_blank" rel="noreferrer">{{ githubUrl }}</a>
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  githubUrl: string
}>()

const copyLabel = ref('复制全文')
let resetTimer: number | undefined

async function copyArticle() {
  const article = document.querySelector('.vp-doc')
  if (!article) return

  const clone = article.cloneNode(true)
  if (!(clone instanceof HTMLElement)) return

  clone.querySelectorAll('.back-button, .article-tools, .header-anchor, button').forEach((node) => node.remove())
  const text = Array.from(clone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, pre, table'))
    .map((node) => (node instanceof HTMLElement ? node.innerText.trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()

  await writeClipboardText(text)
  copyLabel.value = '已复制'

  window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    copyLabel.value = '复制全文'
  }, 1600)
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}
</script>
