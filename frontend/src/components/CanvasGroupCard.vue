<script setup lang="ts">
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import CanvasFieldCard from '@/components/CanvasFieldCard.vue'
import {
  FIELD_TYPE_CATALOG,
  createEmptyField,
  generateFieldId,
  type FieldConfig,
} from '@/composables/useSchemaBuilder'

const props = defineProps<{
  field: FieldConfig
  selected: boolean
  selectedChildIndex: number | null
  columns: number
}>()

const emit = defineEmits<{
  select: []
  remove: []
  duplicate: []
  'select-child': [index: number]
  'update-children': [children: FieldConfig[]]
}>()

const catalogEntry = computed(() =>
  FIELD_TYPE_CATALOG.find((e) => e.type === props.field.type),
)

const children = computed({
  get: () => props.field.children ?? [],
  set: (val: FieldConfig[]) => emit('update-children', val),
})

function onChildAdd(evt: { newIndex?: number }) {
  if (evt.newIndex == null) return
  const raw = children.value[evt.newIndex]

  if (raw && !('name' in raw && 'label' in raw && 'options' in raw)) {
    const updated = [...children.value]
    updated[evt.newIndex] = createEmptyField((raw as any).type)
    emit('update-children', updated)
  }
  emit('select-child', evt.newIndex)
}
</script>

<template>
  <div
    class="relative rounded-xl cursor-pointer transition-all select-none group"
    :class="selected
      ? 'ring-2 ring-ring shadow-sm'
      : 'hover:ring-2 hover:ring-border'"
    :style="{ gridColumn: `span ${columns}` }"
  >
    <!-- Group header overlay with drag handle + name badge + actions -->
    <div
      class="flex items-center justify-between px-2 py-1.5 bg-secondary border-b border-border rounded-t-xl"
      @click.stop="$emit('select')"
    >
      <!-- Left: drag handle + name badge -->
      <div class="flex items-center gap-1">
        <span class="drag-handle cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="10" r="1.5" /><circle cx="15" cy="10" r="1.5" />
            <circle cx="9" cy="15" r="1.5" /><circle cx="15" cy="15" r="1.5" />
            <circle cx="9" cy="20" r="1.5" /><circle cx="15" cy="20" r="1.5" />
          </svg>
        </span>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-primary text-primary-foreground shadow-sm">
          📦 {{ field.name || 'Section' }}
        </span>
        <span v-if="field.label" class="text-xs text-muted-foreground ml-1">{{ field.label }}</span>
      </div>

      <!-- Right: action buttons -->
      <div class="flex items-center gap-0.5">
        <button
          class="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          title="Duplicate section"
          @click.stop="$emit('duplicate')"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        </button>
        <button
          class="p-1 text-muted-foreground hover:text-destructive hover:bg-accent rounded transition-colors"
          title="Delete section"
          @click.stop="$emit('remove')"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Inner drop zone for child fields -->
    <div class="bg-muted/30 rounded-b-xl p-2 border-2 border-dashed border-border min-h-16" @click.stop>
      <VueDraggable
        v-model="children"
        :group="{ name: 'fields', pull: false, put: (to: any, from: any, el: any) => !el?.dataset?.groupCard && !el?.dataset?.fieldId }"
        :animation="200"
        handle=".drag-handle"
        ghost-class="ghost-field"
        chosen-class="chosen-field"
        class="grid grid-cols-12 gap-2 min-h-12"
        @add="onChildAdd"
      >
        <CanvasFieldCard
          v-for="(child, childIdx) in children"
          :key="child.id"
          :field="child"
          :columns="child.columns ?? 12"
          :selected="selectedChildIndex === childIdx"
          @select="$emit('select-child', childIdx)"
          @remove="() => { const c = [...children]; c.splice(childIdx, 1); $emit('update-children', c) }"
          @duplicate="() => {
            const c = [...children]
            const orig = c[childIdx]
            if (!orig) return
            c.splice(childIdx + 1, 0, {
              ...orig,
              id: generateFieldId(),
              name: orig.name ? orig.name + '_copy' : '',
              options: orig.options.map(o => ({ ...o })),
            })
            $emit('update-children', c)
            $emit('select-child', childIdx + 1)
          }"
        />
      </VueDraggable>

      <!-- Empty state -->
      <div
        v-if="children.length === 0"
        class="flex items-center justify-center py-4 text-muted-foreground text-xs"
      >
        <p class="text-center">Drop fields here</p>
      </div>
    </div>
  </div>
</template>
