<template>
  <section class="article-tools" aria-label="文章工具">
    <button class="article-tool-button" type="button" :disabled="!copyReady" @click="copyArticle">
      <span class="article-tool-icon" aria-hidden="true">⧉</span>
      <span>{{ copyLabel }}</span>
    </button>
    <button
      class="article-tool-button"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="sharePanelOpen"
      aria-controls="article-share-panel"
      @click="toggleSharePanel"
    >
      <span class="article-tool-icon" aria-hidden="true">⤴</span>
      <span>分享文章</span>
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
    <div
      v-if="sharePanelOpen"
      id="article-share-panel"
      ref="sharePanel"
      class="article-share-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="article-share-title"
      tabindex="-1"
      @keydown.esc="closeSharePanel"
    >
      <div class="article-share-heading">
        <div>
          <p id="article-share-title" class="article-share-title">分享这篇文章</p>
          <p class="article-share-subtitle">手机可直接调用系统分享；电脑端可扫码分享到微信。</p>
        </div>
        <button class="article-share-close" type="button" aria-label="关闭分享面板" @click="closeSharePanel">×</button>
      </div>

      <div class="article-share-content">
        <div class="article-share-wechat">
          <div class="article-share-qr-frame">
            <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="当前文章的微信分享二维码" width="176" height="176" />
            <span v-else class="article-share-qr-status">{{ qrCodeLabel }}</span>
          </div>
          <div>
            <strong>微信</strong>
            <p>使用微信“扫一扫”打开文章，再通过右上角菜单转发。</p>
          </div>
        </div>

        <div class="article-share-actions" aria-label="社交平台分享选项">
          <button v-if="nativeShareAvailable" class="article-share-action article-share-native" type="button" @click="shareNative">
            <span aria-hidden="true">⌁</span>
            <span>系统分享</span>
          </button>
          <a class="article-share-action" :href="shareLinks.x" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">𝕏</span>
            <span>X</span>
          </a>
          <a class="article-share-action" :href="shareLinks.weibo" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">微</span>
            <span>微博</span>
          </a>
          <a class="article-share-action" :href="shareLinks.linkedin" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">in</span>
            <span>LinkedIn</span>
          </a>
          <a class="article-share-action" :href="shareLinks.facebook" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">f</span>
            <span>Facebook</span>
          </a>
          <a class="article-share-action" :href="shareLinks.whatsapp" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">WA</span>
            <span>WhatsApp</span>
          </a>
          <a class="article-share-action" :href="shareLinks.telegram" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">TG</span>
            <span>Telegram</span>
          </a>
          <a class="article-share-action" :href="shareLinks.email">
            <span aria-hidden="true">@</span>
            <span>邮件</span>
          </a>
          <button class="article-share-action" type="button" @click="copyShareLink">
            <span aria-hidden="true">⧉</span>
            <span>{{ shareCopyLabel }}</span>
          </button>
        </div>
      </div>
    </div>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

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
const sharePanel = ref<HTMLElement>()
const sharePanelOpen = ref(false)
const shareUrl = ref('')
const shareTitle = ref('')
const qrCodeUrl = ref('')
const qrCodeLabel = ref('正在生成二维码…')
const shareCopyLabel = ref('复制链接')
const nativeShareAvailable = ref(false)
let resetTimer: number | undefined
let shareResetTimer: number | undefined

const shareLinks = computed(() => {
  const url = encodeURIComponent(shareUrl.value)
  const title = encodeURIComponent(shareTitle.value)
  const text = encodeURIComponent(`${shareTitle.value} ${shareUrl.value}`.trim())
  return {
    x: `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
    weibo: `https://service.weibo.com/share/share.php?url=${url}&title=${title}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    whatsapp: `https://wa.me/?text=${text}`,
    telegram: `https://t.me/share/url?url=${url}&text=${title}`,
    email: `mailto:?subject=${title}&body=${text}`
  }
})

onMounted(async () => {
  shareUrl.value = `${window.location.origin}${window.location.pathname}`
  shareTitle.value = document.title.split(' | ')[0]?.trim() || '李成律师法律AI工作站'
  nativeShareAvailable.value = typeof navigator.share === 'function'

  if (!props.copyUrl) return
  try {
    copySourceText.value = await fetchCopyText(props.copyUrl)
    copyReady.value = true
  } catch {
    copyLabel.value = '全文加载失败'
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(resetTimer)
  window.clearTimeout(shareResetTimer)
})

async function toggleSharePanel() {
  sharePanelOpen.value = !sharePanelOpen.value
  if (!sharePanelOpen.value) return
  await Promise.all([ensureQrCode(), nextTick()])
  sharePanel.value?.focus({ preventScroll: true })
}

function closeSharePanel() {
  sharePanelOpen.value = false
}

async function ensureQrCode() {
  if (qrCodeUrl.value || !shareUrl.value) return
  try {
    const qrCode = await import('qrcode')
    qrCodeUrl.value = await qrCode.toDataURL(shareUrl.value, {
      width: 352,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#14231b', light: '#ffffff' }
    })
  } catch {
    qrCodeLabel.value = '二维码生成失败，请使用复制链接。'
  }
}

async function shareNative() {
  try {
    await navigator.share({ title: shareTitle.value, url: shareUrl.value })
    closeSharePanel()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    await copyShareLink()
  }
}

async function copyShareLink() {
  try {
    await writeClipboardText(shareUrl.value)
    shareCopyLabel.value = '链接已复制'
  } catch {
    shareCopyLabel.value = '复制失败'
  }
  window.clearTimeout(shareResetTimer)
  shareResetTimer = window.setTimeout(() => {
    shareCopyLabel.value = '复制链接'
  }, 4000)
}

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
  const previousValue = textarea.value
  textarea.value = text
  if (temporary) {
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
  }
  textarea.select()
  const copied = document.execCommand('copy')
  if (temporary) textarea.remove()
  else textarea.value = previousValue
  if (copied) return

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  throw new Error('Clipboard copy command failed')
}
</script>
