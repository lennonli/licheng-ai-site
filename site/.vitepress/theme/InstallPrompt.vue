<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  skillName: { type: String, required: true }
})

const copied = ref(false)
const failed = ref(false)
let resetTimer

const installPrompt = computed(() => `请为我安装法律 skill「${props.skillName}」：
1. 从 GitHub 仓库 lennonli/licheng-skills 的 ${props.skillName}/ 目录获取全部文件（SKILL.md 及 references/、scripts/ 等子目录，保持相对结构）；
2. 将skill安装到正在使用的ai智能体；
3. 完成后用两三句话告诉我这个 skill 的用途和触发方式。`)

async function copy() {
  failed.value = false
  let success = false
  try {
    await navigator.clipboard.writeText(installPrompt.value)
    success = true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = installPrompt.value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { success = document.execCommand('copy') } catch { success = false }
    document.body.removeChild(ta)
  }
  copied.value = success
  failed.value = !success
  clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copied.value = false
    failed.value = false
  }, 2000)
}
onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <div class="install-prompt-box">
    <div class="install-prompt-head">
      <span class="install-prompt-title">一键安装：复制下面的提示词发给你的智能体</span>
      <button class="install-prompt-btn" type="button" @click="copy">
        <span aria-live="polite">{{ copied ? '已复制' : failed ? '复制失败，请手动选择下方文字' : '复制提示词' }}</span>
      </button>
    </div>
    <pre class="install-prompt-code">{{ installPrompt }}</pre>
  </div>
</template>

<style scoped>
.install-prompt-box {
  margin: 16px 0 24px;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-left: 4px solid var(--vp-c-brand-1);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.install-prompt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.install-prompt-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.install-prompt-btn {
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 600;
  padding: 4px 14px;
  cursor: pointer;
  white-space: nowrap;
}

.install-prompt-btn:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
}

.install-prompt-code {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--vp-c-bg);
  border: 1px dashed var(--vp-c-divider);
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  white-space: pre-wrap;
  word-break: break-all;
}

.dark .install-prompt-box {
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.dark .install-prompt-code {
  background: var(--vp-c-bg);
}
</style>
