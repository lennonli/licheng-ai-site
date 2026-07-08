<template>
  <section class="analytics-shell" aria-label="站点访问统计">
    <div class="analytics-hero">
      <div>
        <p class="analytics-eyebrow">Private analytics</p>
        <h1>访问数据与内容分析</h1>
        <p>统计范围：{{ currentRangeLabel }} · 数据源：Cloudflare 边缘请求日志</p>
      </div>
      <div class="analytics-range" aria-label="时间范围">
        <button
          v-for="option in rangeOptions"
          :key="option.value"
          type="button"
          :class="{ active: rangeHours === option.value }"
          @click="setRange(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <form class="analytics-auth" @submit.prevent="loadAnalytics">
      <label for="analytics-key">访问口令</label>
      <div class="analytics-auth-row">
        <input
          id="analytics-key"
          v-model="accessKey"
          type="password"
          autocomplete="current-password"
          placeholder="输入统计页口令"
        />
        <button type="submit" :disabled="loading">
          {{ loading ? '加载中' : '查看数据' }}
        </button>
      </div>
      <p v-if="statusText" class="analytics-status">{{ statusText }}</p>
    </form>

    <div v-if="dashboard" class="analytics-dashboard">
      <div class="analytics-meta">
        <span>站点：{{ dashboard.meta.host }}</span>
        <span>生成时间：{{ formatDateTime(dashboard.meta.generatedAt) }}</span>
      </div>

      <section class="analytics-kpis" aria-label="核心指标">
        <article>
          <span>请求数</span>
          <strong>{{ formatNumber(dashboard.totals.requests) }}</strong>
          <small>包含页面、资源与接口请求</small>
        </article>
        <article>
          <span>访问次数</span>
          <strong>{{ formatNumber(dashboard.totals.visits) }}</strong>
          <small>Cloudflare visits 口径</small>
        </article>
        <article>
          <span>响应流量</span>
          <strong>{{ formatBytes(dashboard.totals.responseBytes) }}</strong>
          <small>边缘节点响应字节数</small>
        </article>
        <article>
          <span>缓存命中</span>
          <strong>{{ formatPercent(dashboard.totals.cacheRatio) }}</strong>
          <small>Hit / Stale / Revalidated</small>
        </article>
      </section>

      <section class="analytics-panel analytics-wide">
        <div class="analytics-panel-head">
          <h2>小时趋势</h2>
          <span>{{ formatDateTime(dashboard.meta.start) }} 至 {{ formatDateTime(dashboard.meta.end) }}</span>
        </div>
        <div class="analytics-bars" aria-label="小时请求趋势">
          <div v-for="point in dashboard.timeline" :key="point.time" class="analytics-bar-cell">
            <span
              class="analytics-bar"
              :style="{ height: `${barHeight(point.requests, maxTimelineRequests)}%` }"
              :title="`${formatHour(point.time)} · ${formatNumber(point.requests)} 次请求`"
            ></span>
            <small>{{ formatHour(point.time) }}</small>
          </div>
        </div>
      </section>

      <div class="analytics-grid">
        <section class="analytics-panel">
          <div class="analytics-panel-head">
            <h2>热门页面</h2>
            <span>过滤静态资源</span>
          </div>
          <AnalyticsList :items="dashboard.topPages" metric="visits" empty="暂无页面访问数据" />
        </section>

        <section class="analytics-panel">
          <div class="analytics-panel-head">
            <h2>访问来源地区</h2>
            <span>按请求数排序</span>
          </div>
          <AnalyticsList :items="dashboard.byCountry" empty="暂无地区数据" />
        </section>

        <section class="analytics-panel">
          <div class="analytics-panel-head">
            <h2>设备类型</h2>
            <span>桌面 / 移动 / 平板</span>
          </div>
          <AnalyticsList :items="dashboard.byDevice" empty="暂无设备数据" />
        </section>

        <section class="analytics-panel">
          <div class="analytics-panel-head">
            <h2>浏览器</h2>
            <span>按 User-Agent 聚合</span>
          </div>
          <AnalyticsList :items="dashboard.byBrowser" empty="暂无浏览器数据" />
        </section>
      </div>

      <section class="analytics-panel analytics-wide">
        <div class="analytics-panel-head">
          <h2>原始热门路径</h2>
          <span>包含资源请求，用于排查异常流量</span>
        </div>
        <AnalyticsList :items="dashboard.topPathsRaw" empty="暂无路径数据" />
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import type { PropType } from 'vue'

type AnalyticsItem = {
  label: string
  count: number
  visits?: number
}

type Dashboard = {
  meta: {
    host: string
    start: string
    end: string
    generatedAt: string
  }
  totals: {
    requests: number
    visits: number
    requestBytes: number
    responseBytes: number
    cacheRatio: number
  }
  topPages: AnalyticsItem[]
  topPathsRaw: AnalyticsItem[]
  byCountry: AnalyticsItem[]
  byDevice: AnalyticsItem[]
  byBrowser: AnalyticsItem[]
  timeline: Array<{
    time: string
    requests: number
    visits: number
  }>
}

const storageKey = 'lc-analytics-access-key'
const rangeOptions = [
  { label: '1 小时', value: 1 },
  { label: '6 小时', value: 6 },
  { label: '12 小时', value: 12 },
  { label: '24 小时', value: 24 }
]

const accessKey = ref('')
const rangeHours = ref(24)
const loading = ref(false)
const statusText = ref('')
const dashboard = ref<Dashboard | null>(null)

const currentRangeLabel = computed(() => rangeOptions.find((item) => item.value === rangeHours.value)?.label || '24 小时')
const maxTimelineRequests = computed(() => Math.max(...(dashboard.value?.timeline || []).map((item) => item.requests), 1))

onMounted(() => {
  accessKey.value = sessionStorage.getItem(storageKey) || ''
  if (accessKey.value) {
    loadAnalytics()
  }
})

function setRange(value: number) {
  rangeHours.value = value
  if (dashboard.value && accessKey.value) {
    loadAnalytics()
  }
}

async function loadAnalytics() {
  if (!accessKey.value.trim()) {
    statusText.value = '请输入访问口令。'
    return
  }

  loading.value = true
  statusText.value = ''

  try {
    const response = await fetch('/api/site-analytics', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-analytics-key': accessKey.value.trim()
      },
      body: JSON.stringify({
        rangeHours: rangeHours.value
      })
    })
    const data = await response.json()
    if (!response.ok || data.error) {
      dashboard.value = null
      statusText.value = data.error || '数据加载失败。'
      return
    }
    sessionStorage.setItem(storageKey, accessKey.value.trim())
    dashboard.value = data
    statusText.value = ''
  } catch (error) {
    dashboard.value = null
    statusText.value = error instanceof Error ? error.message : '数据加载失败。'
  } finally {
    loading.value = false
  }
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatPercent(value = 0) {
  return `${Math.round(value * 100)}%`
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let amount = value / 1024
  let index = 0
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024
    index += 1
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[index]}`
}

function formatDateTime(value: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function formatHour(value: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit'
  }).format(new Date(value))
}

function barHeight(value: number, max: number) {
  if (!value || !max) return 6
  return Math.max(8, Math.round((value / max) * 100))
}

const AnalyticsList = defineComponent({
  props: {
    items: {
      type: Array as PropType<AnalyticsItem[]>,
      required: true
    },
    metric: {
      type: String,
      default: 'count'
    },
    empty: {
      type: String,
      default: '暂无数据'
    }
  },
  setup(props) {
    return () => {
      if (!props.items.length) {
        return h('p', { class: 'analytics-empty' }, props.empty)
      }

      const max = Math.max(...props.items.map((item) => props.metric === 'visits' ? item.visits || item.count : item.count), 1)
      return h('ol', { class: 'analytics-list' }, props.items.map((item) => {
        const value = props.metric === 'visits' ? item.visits || item.count : item.count
        return h('li', { key: item.label }, [
          h('div', { class: 'analytics-list-row' }, [
            h('span', item.label),
            h('strong', formatNumber(value))
          ]),
          h('span', { class: 'analytics-list-bar' }, [
            h('span', { style: { width: `${Math.max(4, Math.round((value / max) * 100))}%` } })
          ])
        ])
      }))
    }
  }
})
</script>
