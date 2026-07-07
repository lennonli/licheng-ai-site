<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const isVisible = ref(false)

function updateVisibility() {
  isVisible.value = window.scrollY > 360
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

onMounted(() => {
  updateVisibility()
  window.addEventListener('scroll', updateVisibility, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateVisibility)
})
</script>

<template>
  <button
    class="back-to-top-button"
    :class="{ 'is-visible': isVisible }"
    type="button"
    aria-label="回到页面顶端"
    title="回到页面顶端"
    @click="scrollToTop"
  >
    <span aria-hidden="true">↑</span>
  </button>
</template>
