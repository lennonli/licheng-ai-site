<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface Deal {
  year: number
  code: string
  name: string
  board: string | null
  status: string | null
  change_type: string | null
  first_announce_date: string | null
  file: string
}

const YEARS = [2026, 2025, 2024, 2023, 2022]
const RAW_BASE = 'https://raw.githubusercontent.com/lennonli/ctl-deals-kb/main'
const BLOB_BASE = 'https://github.com/lennonli/ctl-deals-kb/blob/main'
const PAGE_SIZE = 100

const deals = ref<Deal[]>([])
const loading = ref(true)
const failed = ref(false)
const query = ref('')
const year = ref('')
const status = ref('')

const statuses = computed(() => [...new Set(deals.value.map((d) => d.status).filter(Boolean))] as string[])
const filtered = computed(() => {
  const q = query.value.trim().toLocaleLowerCase()
  return deals.value.filter((d) =>
    (!year.value || d.year === Number(year.value)) &&
    (!status.value || d.status === status.value) &&
    (!q || d.code.includes(q) || (d.name || '').toLocaleLowerCase().includes(q) || (d.change_type || '').toLocaleLowerCase().includes(q))
  )
})
const shown = computed(() => filtered.value.slice(0, PAGE_SIZE))

function reset() {
  query.value = ''
  year.value = ''
  status.value = ''
}

onMounted(async () => {
  try {
    const all: Deal[] = []
    for (const y of YEARS) {
      const res = await fetch(`${RAW_BASE}/${y}/index.json`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      for (const d of data.deals) all.push({ year: y, ...d })
    }
    deals.value = all
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="ctl-search" aria-label="控制权变更案例检索">
    <div class="case-filter">
      <label>代码、公司简称或变更方式
        <input v-model="query" type="search" placeholder="例如：000633 / 科德教育 / 间接收购" :disabled="loading || failed" />
      </label>
      <label>年度
        <select v-model="year" :disabled="loading || failed">
          <option value="">全部年度</option>
          <option v-for="y in YEARS" :key="y" :value="String(y)">{{ y }} 年</option>
        </select>
      </label>
      <label>交易状态
        <select v-model="status" :disabled="loading || failed">
          <option value="">全部状态</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <button type="button" :disabled="loading || failed" @click="reset">重置</button>
    </div>

    <p v-if="loading" class="ctl-note">正在从公开数据仓读取索引……</p>
    <p v-else-if="failed" class="ctl-note">
      索引读取失败，请稍后重试，或直接前往
      <a href="https://github.com/lennonli/ctl-deals-kb" target="_blank" rel="noreferrer">GitHub 数据仓</a>
      浏览全部数据。
    </p>
    <template v-else>
      <p class="ctl-note">
        共检索到 <strong>{{ filtered.length }}</strong> 单<span v-if="filtered.length > PAGE_SIZE">，显示前 {{ PAGE_SIZE }} 单，请用关键词或筛选条件缩小范围</span>。点击证券代码可打开该案例在数据仓中的完整记录。
      </p>
      <div class="ctl-table-wrap">
        <table class="ctl-table">
          <thead>
            <tr>
              <th>年度</th>
              <th>证券代码</th>
              <th>公司简称</th>
              <th>板块</th>
              <th>变更方式</th>
              <th>交易状态</th>
              <th>首次公告日</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in shown" :key="`${d.year}-${d.file}`">
              <td>{{ d.year }}</td>
              <td><a :href="`${BLOB_BASE}/${d.year}/${d.file}`" target="_blank" rel="noreferrer">{{ d.code }}</a></td>
              <td>{{ d.name }}</td>
              <td>{{ d.board || '未标注' }}</td>
              <td>{{ d.change_type || '未标注' }}</td>
              <td>{{ d.status || '未标注' }}</td>
              <td>{{ d.first_announce_date || '—' }}</td>
            </tr>
            <tr v-if="!shown.length">
              <td colspan="7">没有符合条件的案例，换个关键词试试。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.ctl-note { margin: 12px 0; color: var(--vp-c-text-2); font-size: 14px; }
.ctl-table-wrap { overflow-x: auto; }
.ctl-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.ctl-table th, .ctl-table td { padding: 8px 10px; border: 1px solid var(--vp-c-divider); text-align: left; white-space: nowrap; }
.ctl-table thead th { background: var(--vp-c-bg-soft); }
</style>
