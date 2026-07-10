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
  window.location.href = props.fallback
}
</script>

<template>
  <button class="back-button" type="button" @click="goBack">
    <span aria-hidden="true">←</span>
    <span>返回上一级</span>
  </button>
</template>
