<template>
  <div v-if="isVisible" class="water-circles-loading">
    <div class="circle circle-1"></div>
    <div class="circle circle-2"></div>
    <div class="circle circle-3"></div>
    <div class="circle circle-4"></div>
    <div class="circle circle-5"></div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const isVisible = ref(props.show)

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      isVisible.value = true
    } else {
      setTimeout(() => {
        isVisible.value = false
      }, 500) // Match the fade-out duration
    }
  }
)
</script>

<style lang="scss" scoped>
.water-circles-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: transparent;
  transition: opacity 0.5s ease-out;
  opacity: 1;

  &.fade-out {
    opacity: 0;
  }
}

.circle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 50px;
  height: 50px;
  border: 2px solid rgba(66, 210, 177, 0.5);
  box-shadow: 0 0 10px 2px rgba(66, 210, 177, 0.7) 0 0 -10px 2px rgba(66, 210, 177, 0.5);
  border-radius: 50%;
  margin: 0 5px;
  opacity: 0;
  animation: waterRipple 5s infinite;
}

.circle-1 {
  animation-delay: 0s;
}

.circle-2 {
  animation-delay: 1s;
}

.circle-3 {
  animation-delay: 2s;
}

.circle-4 {
  animation-delay: 3s;
}

.circle-5 {
  animation-delay: 4s;
}

@keyframes waterRipple {

  0% {
    transform: scale(1);
    opacity: 0;
    box-shadow: 0 0 10px 2px rgba(66, 210, 177, 0.7);
  }

  100% {
    transform: scale(15);
    box-shadow: 0 0 10px 10px rgba(66, 210, 177, 0.7);
    opacity: 0;
  }

  20% {
    transform: scale(1);
    opacity: 0.7;
  }
}
</style>