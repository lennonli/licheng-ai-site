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
    <a v-if="immersiveUrl" class="article-tool-link" :href="immersiveUrl" target="_blank" rel="noreferrer">
      <span class="article-tool-icon" aria-hidden="true">▣</span>
      <span>打开沉浸版</span>
    </a>
    <time v-if="updatedAt" class="article-updated" :datetime="updatedAt">更新日期：{{ updatedAt }}</time>
    <p class="article-source-url">
      源文件：<a :href="githubUrl" target="_blank" rel="noreferrer">{{ githubUrl }}</a>
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  githubUrl: string
  updatedAt?: string
  immersiveUrl?: string
}>()

const copyLabel = ref('复制全文')
let resetTimer: number | undefined

async function copyArticle() {
  const article = document.querySelector('.vp-doc')
  if (!article) return

  const clone = article.cloneNode(true)
  if (!(clone instanceof HTMLElement)) return

  clone.querySelectorAll('.back-button, .article-tools, .header-anchor, .html-tutorial-copy-source, button, iframe').forEach((node) => node.remove())
  clone.querySelectorAll('img').forEach((image) => {
    const replacement = document.createElement('span')
    replacement.textContent = image.getAttribute('alt') || ''
    image.replaceWith(replacement)
  })
  const immersiveText = article.querySelector<HTMLElement>('.html-tutorial-copy-source')?.textContent?.trim() || ''
  const text = [clone.innerText.trim(), immersiveText]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()

  try {
    await writeClipboardText(text)
    copyLabel.value = '已复制'
  } catch {
    copyLabel.value = '复制失败'
  }

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
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Clipboard copy command failed')
}
</script>
