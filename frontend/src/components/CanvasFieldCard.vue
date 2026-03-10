<script setup lang="ts">
import { computed } from 'vue'
import {
  FIELD_TYPE_CATALOG,
  buildSingleFieldSchema,
  type FieldConfig,
} from '@/composables/useSchemaBuilder'

const props = defineProps<{
  field: FieldConfig
  selected: boolean
  columns: number
}>()

defineEmits<{
  select: []
  remove: []
  duplicate: []
}>()

const catalogEntry = computed(() =>
  FIELD_TYPE_CATALOG.find((e) => e.type === props.field.type),
)

const fieldSchema = computed(() => buildSingleFieldSchema(props.field))
const hasSchema = computed(() => Object.keys(fieldSchema.value).length > 0)
</script>

<template>
  <div
    class="relative rounded-lg cursor-pointer transition-all select-none group pt-6"
    :class="selected
      ? 'ring-2 ring-indigo-400 shadow-sm'
      : 'hover:ring-2 hover:ring-gray-300'"
    :style="{ gridColumn: `span ${columns}` }"
    :data-field-id="field.id"
    @click="$emit('select')"
  >
    <!-- Hover/select overlay with name badge + actions -->
    <div
      class="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-1 py-0.5 transition-opacity rounded-t-lg"
      :class="selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
    >
      <!-- Left: drag handle + name badge -->
      <div class="flex items-center gap-1">
        <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="10" r="1.5" /><circle cx="15" cy="10" r="1.5" />
            <circle cx="9" cy="15" r="1.5" /><circle cx="15" cy="15" r="1.5" />
            <circle cx="9" cy="20" r="1.5" /><circle cx="15" cy="20" r="1.5" />
          </svg>
        </span>
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500 text-white shadow-sm">
          {{ field.name || catalogEntry?.label || field.type }}
        </span>
      </div>

      <!-- Right: action buttons -->
      <div class="flex items-center gap-0.5">
        <button
          class="p-1 text-gray-400 hover:text-indigo-600 hover:bg-white rounded transition-colors"
          title="Duplicate field"
          @click.stop="$emit('duplicate')"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        </button>
        <button
          class="p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded transition-colors"
          title="Delete field"
          @click.stop="$emit('remove')"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Non-fillable Vueform field preview -->
    <div class="pointer-events-none bg-white rounded-lg px-3 py-2 min-h-10">
      <Vueform
        v-if="hasSchema"
        :schema="fieldSchema"
        :endpoint="false"
        :display-errors="false"
        size="sm"
      />
      <div v-else class="flex items-center gap-2 py-2 text-sm text-gray-400">
        <span>{{ catalogEntry?.icon ?? '📦' }}</span>
        <span>{{ catalogEntry?.label || field.type }}</span>
      </div>
    </div>
  </div>
</template>
