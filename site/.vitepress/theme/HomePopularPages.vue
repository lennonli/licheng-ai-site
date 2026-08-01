<template>
  <section class="home-popular" aria-labelledby="home-popular-title">
    <div class="home-popular-heading">
      <div>
        <p class="home-section-kicker">Most visited</p>
        <h2 id="home-popular-title">点击最多的文章</h2>
      </div>
      <span class="home-popular-period">历史累计（可查询期间） · 每日更新</span>
    </div>

    <div v-if="loading" class="home-popular-state">正在读取访问数据……</div>
    <div v-else-if="items.length" class="home-popular-list">
      <a v-for="(item, index) in items" :key="item.href" class="home-popular-item" :href="item.href">
        <span class="home-popular-rank">0{{ index + 1 }}</span>
        <span class="home-popular-copy">
          <strong>{{ item.title }}</strong>
          <small>{{ item.section }} · {{ item.visits }} 次访问</small>
        </span>
        <span class="home-popular-arrow" aria-hidden="true">↗</span>
      </a>
    </div>
    <p v-else class="home-popular-state">访问数据正在积累，热门文章将在有有效数据后显示。</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

type IndexItem = {
  href: string
  title: string
  summary?: string
  section?: string
}

type AnalyticsItem = {
  label: string
  visits?: number
  count?: number
}

type PopularItem = IndexItem & { visits: number }

const items = ref<PopularItem[]>([])
const loading = ref(true)

function normalizePath(value: string) {
  const path = value.split('?')[0].split('#')[0]
  if (path === '/') return '/'
  return path.replace(/\/+$/, '') || '/'
}

onMounted(async () => {
  try {
    const [analyticsResponse, indexResponse] = await Promise.all([
      fetch('/api/site-analytics?public=top', { headers: { accept: 'application/json' } }),
      fetch('/content-index.json', { headers: { accept: 'application/json' } })
    ])

    if (!analyticsResponse.ok || !indexResponse.ok) return

    const analytics = (await analyticsResponse.json()) as { topPages?: AnalyticsItem[] }
    const index = (await indexResponse.json()) as IndexItem[]
    const indexByPath = new Map(index.map((item) => [normalizePath(item.href), item]))

    items.value = (analytics.topPages || [])
      .map((entry) => {
        const page = indexByPath.get(normalizePath(entry.label))
        if (!page) return null
        return { ...page, visits: entry.visits || entry.count || 0 }
      })
      .filter((item): item is PopularItem => Boolean(item))
      .slice(0, 5)
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
})
</script>
