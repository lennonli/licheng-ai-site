<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
const { frontmatter } = useData()
const props = withDefaults(
  defineProps<{
    fallback?: string
  }>(),
  {
    fallback: '/'
  }
)

const destination = computed(() => frontmatter.value.reading?.parent || props.fallback)
const label = computed(() => frontmatter.value.reading ? '返回系列目录' : destination.value === '/' ? '返回首页' : '返回栏目目录')
</script>

<template>
  <a class="back-button" :href="destination">
    <span aria-hidden="true">←</span>
    <span>{{ label }}</span>
  </a>
</template>
