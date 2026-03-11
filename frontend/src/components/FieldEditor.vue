<script setup lang="ts">
import { computed } from 'vue'
import { FIELD_TYPE_CATALOG, type FieldConfig } from '@/composables/useSchemaBuilder'

const props = defineProps<{
  field: FieldConfig
  index: number
}>()

const emit = defineEmits<{
  update: [field: FieldConfig]
  remove: []
}>()

const typeLabel = computed(() => {
  const entry = FIELD_TYPE_CATALOG.find((e) => e.type === props.field.type)
  return entry ? `${entry.icon} ${entry.label}` : props.field.type
})

const needsOptions = computed(() =>
  ['select', 'checkboxgroup', 'radiogroup'].includes(props.field.type),
)

const showPlaceholder = computed(() =>
  ['text', 'email', 'number', 'textarea', 'select'].includes(props.field.type),
)

const isGroup = computed(() => props.field.type === 'group')

function update(patch: Partial<FieldConfig>) {
  emit('update', { ...props.field, ...patch })
}

function addOption() {
  update({ options: [...props.field.options, { value: '', label: '' }] })
}

function removeOption(index: number) {
  update({ options: props.field.options.filter((_, i) => i !== index) })
}

function updateOption(index: number, key: 'value' | 'label', val: string) {
  const options = [...props.field.options]
  options[index] = { ...options[index], [key]: val }
  update({ options })
}

function autoSlugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}
</script>

<template>
  <div class="bg-card border border-border rounded-lg p-3 shadow-sm">
    <div class="flex items-center justify-between mb-2">
      <!-- Type badge -->
      <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground border border-border">
        {{ typeLabel }}
      </span>
      <button
        class="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
        title="Delete field"
        @click="emit('remove')"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>

    <div class="space-y-2">
      <!-- Field Name -->
      <div>
        <label class="block text-[10px] font-medium text-muted-foreground mb-0.5">Name (key)</label>
        <input
          type="text"
          :value="field.name"
          class="w-full border border-input bg-transparent rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="e.g. full_name"
          @input="update({ name: autoSlugify(($event.target as HTMLInputElement).value) })"
        />
      </div>

      <!-- Label -->
      <div>
        <label class="block text-[10px] font-medium text-muted-foreground mb-0.5">Label</label>
        <input
          type="text"
          :value="field.label"
          class="w-full border border-input bg-transparent rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="e.g. Full Name"
          @input="update({ label: ($event.target as HTMLInputElement).value })"
        />
      </div>

      <!-- Placeholder -->
      <div v-if="showPlaceholder && !isGroup">
        <label class="block text-[10px] font-medium text-muted-foreground mb-0.5">Placeholder</label>
        <input
          type="text"
          :value="field.placeholder"
          class="w-full border border-input bg-transparent rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          @input="update({ placeholder: ($event.target as HTMLInputElement).value })"
        />
      </div>

      <!-- Required + Extra Rules row -->
      <div v-if="!isGroup" class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs text-foreground">
          <input
            type="checkbox"
            :checked="field.required"
            class="rounded w-3.5 h-3.5 accent-primary"
            @change="update({ required: ($event.target as HTMLInputElement).checked })"
          />
          Required
        </label>
      </div>

      <!-- Extra Rules -->
      <div v-if="!isGroup">
        <label class="block text-[10px] font-medium text-muted-foreground mb-0.5">Validation Rules</label>
        <input
          type="text"
          :value="field.extraRules"
          class="w-full border border-input bg-transparent rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="e.g. min:3|max:100"
          @input="update({ extraRules: ($event.target as HTMLInputElement).value })"
        />
      </div>

      <!-- Width (columns) -->
      <div>
        <label class="block text-[10px] font-medium text-muted-foreground mb-1">Width</label>
        <div class="flex rounded-md border border-border overflow-hidden">
          <button
            v-for="opt in [{ label: 'Full', value: 12 }, { label: '1/2', value: 6 }, { label: '1/3', value: 4 }, { label: '1/4', value: 3 }]"
            :key="opt.value"
            class="flex-1 px-1 py-1 text-[10px] font-medium transition-colors border-r last:border-r-0 border-border"
            :class="(field.columns ?? 12) === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground hover:bg-accent'"
            @click="update({ columns: opt.value })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <!-- Children count indicator for groups -->
      <div v-if="isGroup" class="pt-1">
        <p class="text-[10px] text-muted-foreground">
          {{ (field.children?.length ?? 0) }} field(s) inside this section
        </p>
      </div>
    </div>

    <!-- Options Editor -->
    <div v-if="needsOptions && !isGroup" class="mt-2 border-t border-border pt-2">
      <label class="block text-[10px] font-medium text-muted-foreground mb-1">Options</label>
      <div v-for="(opt, i) in field.options" :key="i" class="flex gap-1 mb-1.5">
        <input
          type="text"
          :value="opt.value"
          class="flex-1 border border-input bg-transparent rounded px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Value"
          @input="updateOption(i, 'value', ($event.target as HTMLInputElement).value)"
        />
        <input
          type="text"
          :value="opt.label"
          class="flex-1 border border-input bg-transparent rounded px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Label"
          @input="updateOption(i, 'label', ($event.target as HTMLInputElement).value)"
        />
        <button
          class="text-destructive hover:text-destructive/80 text-xs px-0.5"
          @click="removeOption(i)"
        >
          ✕
        </button>
      </div>
      <button
        class="text-xs text-foreground hover:text-foreground/80 font-medium"
        @click="addOption"
      >
        + Add Option
      </button>
    </div>
  </div>
</template>
