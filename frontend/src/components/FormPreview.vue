<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  schema: Record<string, any>
}>()

const hasFields = computed(() =>
  Object.keys(props.schema).some((k) => k !== 'submit'),
)
</script>

<template>
  <div class="preview-wrapper bg-card border border-border rounded-xl shadow-sm overflow-hidden">
    <div class="bg-muted border-b border-border px-4 py-2.5 flex items-center gap-2">
      <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      <h3 class="text-sm font-semibold text-foreground">Live Preview</h3>
    </div>

    <div class="p-6 pointer-events-none">
      <div v-if="!hasFields" class="text-center py-8 text-muted-foreground text-sm">
        Fields will appear here as you add them
      </div>
      <Vueform
        v-else
        :schema="schema"
        :endpoint="false"
        :display-errors="false"
      />
    </div>
  </div>
</template>

<style scoped>
/* Form-like spacing between fields */
.preview-wrapper :deep(.vf-element) {
  margin-bottom: 1.25rem;
}

.preview-wrapper :deep(.vf-element:last-child) {
  margin-bottom: 0;
}

/* Labels */
.preview-wrapper :deep(label) {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  margin-bottom: 0.375rem;
  display: block;
}
</style>
