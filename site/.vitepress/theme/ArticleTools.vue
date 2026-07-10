<template>
  <section class="article-tools" aria-label="文章工具">
    <button class="article-tool-button" type="button" :disabled="!copyReady" @click="copyArticle">
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
    <textarea
      v-if="copyUrl"
      ref="copyBuffer"
      class="article-copy-buffer"
      :value="copySourceText"
      readonly
      tabindex="-1"
      aria-hidden="true"
    />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  githubUrl: string
  updatedAt?: string
  immersiveUrl?: string
  copyUrl?: string
}>()

const copyLabel = ref('复制全文')
const copyReady = ref(!props.copyUrl)
const copySourceText = ref('')
const copyBuffer = ref<HTMLTextAreaElement>()
let resetTimer: number | undefined

onMounted(async () => {
  if (!props.copyUrl) return
  try {
    copySourceText.value = await fetchCopyText(props.copyUrl)
    copyReady.value = true
  } catch {
    copyLabel.value = '全文加载失败'
  }
})

async function copyArticle() {
  const article = document.querySelector('.vp-doc')
  if (!article) return

  const clone = article.cloneNode(true)
  if (!(clone instanceof HTMLElement)) return

  clone.querySelectorAll('.back-button, .article-tools, .header-anchor, button, iframe').forEach((node) => node.remove())
  clone.querySelectorAll('img').forEach((image) => {
    const replacement = document.createElement('span')
    replacement.textContent = image.getAttribute('alt') || ''
    image.replaceWith(replacement)
  })
  try {
    const immersiveText = copySourceText.value
    const text = [clone.innerText.trim(), immersiveText]
      .filter(Boolean)
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim()
    await writeClipboardText(text)
    copyLabel.value = '已复制'
  } catch {
    copyLabel.value = '复制失败'
  }

  window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    copyLabel.value = '复制全文'
  }, 4000)
}

async function fetchCopyText(url: string) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Copy source responded with ${response.status}`)
  return (await response.text()).trim()
}

async function writeClipboardText(text: string) {
  const textarea = copyBuffer.value || document.createElement('textarea')
  const temporary = !copyBuffer.value
  if (temporary) {
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
  }
  textarea.select()
  const copied = document.execCommand('copy')
  if (temporary) textarea.remove()
  if (copied) return

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  throw new Error('Clipboard copy command failed')
}
</script>
