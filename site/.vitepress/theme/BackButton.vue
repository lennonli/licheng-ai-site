<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    fallback?: string
  }>(),
  {
    fallback: '/'
  }
)

function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back()
    return
  }

  window.location.href = props.fallback
}
</script>

<template>
  <button class="back-button" type="button" @click="goBack">
    <span aria-hidden="true">←</span>
    <span>返回上一个页面</span>
  </button>
</template>
