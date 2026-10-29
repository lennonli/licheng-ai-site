<template>
  <section class="home-search" aria-label="站内搜索">
    <button class="home-search-button" type="button" @click="openSearch">
      <span class="home-search-icon" aria-hidden="true"></span>
      <span class="home-search-text">搜索指令、技能、教程与课程</span>
      <span class="home-search-action">搜索</span>
    </button>
    <p class="home-search-hint">按标题、章节与摘要搜索。案例可在案例库页面按年度筛选，或交由 AI 定向检索。</p>
  </section>
</template>

<script setup lang="ts">
function openSearch() {
  const selectors = [
    '#local-search .DocSearch-Button',
    '.DocSearch-Button',
    '#local-search button',
    'button[aria-label*="Search"]',
    'button[aria-label*="搜索"]'
  ]

  for (const selector of selectors) {
    const button = document.querySelector(selector)
    if (button instanceof HTMLButtonElement) {
      button.click()
      return
    }
  }

  const keyboardEvent = new KeyboardEvent('keydown', {
    key: 'k',
    metaKey: true,
    bubbles: true
  })
  document.dispatchEvent(keyboardEvent)
}
</script>
