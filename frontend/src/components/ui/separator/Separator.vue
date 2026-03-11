<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div role="separator" :class="cn('shrink-0 bg-border h-px w-full', props.class)" />
</template>
