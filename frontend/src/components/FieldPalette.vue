<script setup lang="ts">
import { ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { FIELD_TYPE_CATALOG } from '@/composables/useSchemaBuilder'

const paletteItems = ref(FIELD_TYPE_CATALOG.map((entry) => ({ ...entry })))
</script>

<template>
  <div>
    <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Field Types</h2>
    <VueDraggable
      v-model="paletteItems"
      :group="{ name: 'fields', pull: 'clone', put: false }"
      :sort="false"
      :animation="200"
      class="space-y-1.5"
    >
      <div
        v-for="entry in paletteItems"
        :key="entry.type"
        class="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-border rounded-lg cursor-grab hover:border-ring hover:shadow-sm transition-all text-sm select-none"
      >
        <span class="text-base">{{ entry.icon }}</span>
        <span class="font-medium text-foreground">{{ entry.label }}</span>
      </div>
    </VueDraggable>
  </div>
</template>
