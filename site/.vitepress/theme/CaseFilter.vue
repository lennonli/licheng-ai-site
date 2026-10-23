<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const query = ref('')
const board = ref('')
const boards = ref<string[]>([])
const count = ref(0)
const ready = ref(false)
let directory: HTMLElement | null = null
let groups: { heading: HTMLElement; grid: HTMLElement; name: string; cards: HTMLElement[] }[] = []

function filter(updateUrl = true) {
  const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  let total = 0
  groups.forEach(group => {
    let visible = 0
    group.cards.forEach(card => {
      const match = (!board.value || group.name === board.value) && terms.every(term => (card.textContent || '').toLocaleLowerCase().includes(term))
      card.hidden = !match
      if (match) visible++
    })
    group.heading.hidden = !visible
    group.grid.hidden = !visible
    total += visible
  })
  count.value = total
  if (updateUrl) {
    const url = new URL(location.href)
    query.value.trim() ? url.searchParams.set('q', query.value.trim()) : url.searchParams.delete('q')
    board.value ? url.searchParams.set('board', board.value) : url.searchParams.delete('board')
    history.replaceState(history.state, '', url)
  }
}
function restore() {
  const params = new URLSearchParams(location.search)
  query.value = params.get('q') || ''
  board.value = params.get('board') || ''
  filter(false)
}
function reset() { query.value = ''; board.value = ''; filter() }
onMounted(() => {
  directory = document.querySelector('.case-directory')
  groups = Array.from(directory?.querySelectorAll<HTMLElement>(':scope > h2') || []).map(heading => {
    const grid = heading.nextElementSibling as HTMLElement
    return { heading, grid, name: (heading.textContent || '').replace(/（\d+）.*$/, '').replace(/#$/, '').trim(), cards: Array.from(grid.querySelectorAll<HTMLElement>('.index-card')) }
  })
  boards.value = groups.map(group => group.name)
  ready.value = true
  restore()
  window.addEventListener('popstate', restore)
})
onBeforeUnmount(() => window.removeEventListener('popstate', restore))
</script>

<template>
  <section class="case-filter" aria-label="筛选本年度案例">
    <label>公司、代码、律所或标签
      <input v-model="query" type="search" placeholder="例如：股权代持" :disabled="!ready" @input="filter()" />
    </label>
    <label>板块
      <select v-model="board" :disabled="!ready" @change="filter()">
        <option value="">全部板块</option>
        <option v-for="name in boards" :key="name">{{ name }}</option>
      </select>
    </label>
    <button type="button" @click="reset">清除筛选</button>
    <p v-if="ready" role="status" aria-live="polite">找到 {{ count }} 份案例<span v-if="!count">，请减少关键词或选择其他板块。</span></p>
    <p class="case-filter-hint">全站搜索收录指令、技能、教程与课程。案例可在本页筛选公司信息、直接打开阅读，或参阅<a href="/kbskill/">知识库使用教程</a>交由 AI 检索。</p>
  </section>
</template>
