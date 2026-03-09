<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import CanvasFieldCard from '@/components/CanvasFieldCard.vue'
import FieldEditor from '@/components/FieldEditor.vue'
import FieldPalette from '@/components/FieldPalette.vue'
import FormPreview from '@/components/FormPreview.vue'
import {
  useSchemaBuilder,
  schemaToFields,
  createEmptyField,
  type FieldConfig,
} from '@/composables/useSchemaBuilder'
import { createForm, updateForm, getForm } from '@/services/api'

const route = useRoute()
const router = useRouter()

const formName = ref('')
const formDescription = ref('')
const fields = ref<FieldConfig[]>([])
const saving = ref(false)
const loading = ref(false)
const dragging = ref(false)
const selectedIndex = ref<number | null>(null)
const showPreview = ref(false)

const selectedField = computed(() =>
  selectedIndex.value !== null ? fields.value[selectedIndex.value] ?? null : null,
)

const editId = route.params.id as string | undefined
const isEdit = Boolean(editId)

const { schema } = useSchemaBuilder(fields)

onMounted(async () => {
  if (isEdit && editId) {
    loading.value = true
    try {
      const { data } = await getForm(editId)
      formName.value = data.name
      formDescription.value = data.description || ''
      fields.value = schemaToFields(data.schema)
    } finally {
      loading.value = false
    }
  }
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
  if (selectedIndex.value === null) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, fields.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    removeField(selectedIndex.value)
  }
}

function onCanvasAdd(evt: { newIndex?: number }) {
  if (evt.newIndex == null) return
  const raw = fields.value[evt.newIndex]
  if (raw && !('name' in raw && 'label' in raw && 'options' in raw)) {
    fields.value[evt.newIndex] = createEmptyField((raw as any).type)
  }
  selectedIndex.value = evt.newIndex
}

function updateField(index: number, field: FieldConfig) {
  fields.value[index] = field
}

function removeField(index: number) {
  fields.value.splice(index, 1)
  if (fields.value.length === 0) {
    selectedIndex.value = null
  } else if (selectedIndex.value !== null) {
    if (index === selectedIndex.value) {
      selectedIndex.value = Math.min(index, fields.value.length - 1)
    } else if (index < selectedIndex.value) {
      selectedIndex.value--
    }
  }
}

function duplicateField(index: number) {
  const original = fields.value[index]
  if (!original) return
  const copy: FieldConfig = {
    name: original.name ? `${original.name}_copy` : '',
    type: original.type,
    label: original.label,
    placeholder: original.placeholder,
    required: original.required,
    options: original.options.map((o) => ({ ...o })),
    extraRules: original.extraRules,
  }
  fields.value.splice(index + 1, 0, copy)
  selectedIndex.value = index + 1
}

async function save() {
  if (!formName.value.trim()) return alert('Form name is required')
  if (fields.value.every((f) => !f.name)) return alert('Add at least one field with a name')

  saving.value = true
  try {
    const payload = {
      name: formName.value,
      description: formDescription.value || undefined,
      schema: schema.value,
    }

    if (isEdit && editId) {
      await updateForm(editId, payload)
    } else {
      await createForm(payload)
    }
    router.push('/forms')
  } catch (err: any) {
    alert(err.response?.data?.message || 'Failed to save form')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

  <div v-else class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900">
        {{ isEdit ? 'Edit Form' : 'New Form' }}
      </h1>
      <button
        class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Saving...' : 'Save Form' }}
      </button>
    </div>

    <!-- Form metadata -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Form Name</label>
        <input
          v-model="formName"
          type="text"
          class="w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="e.g. Job Application"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          v-model="formDescription"
          type="text"
          class="w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="Optional description"
        />
      </div>
    </div>

    <!-- Three-column layout: palette | canvas | properties -->
    <div class="flex gap-0 flex-1 min-h-0">
      <!-- Left: Palette sidebar -->
      <div class="w-52 shrink-0 border-r border-gray-200 pr-4 overflow-y-auto">
        <FieldPalette />
      </div>

      <!-- Center: Canvas (drop zone + reorder) -->
      <div class="flex-1 min-w-0 px-6 overflow-y-auto">
        <div class="max-w-lg mx-auto">
          <!-- Canvas header -->
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Canvas</h2>
            <button
              class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors"
              :class="showPreview
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'"
              @click="showPreview = !showPreview"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
          </div>

          <!-- Drop zone -->
          <VueDraggable
            v-model="fields"
            :group="{ name: 'fields', put: true }"
            :animation="200"
            handle=".drag-handle"
            ghost-class="ghost-field"
            chosen-class="chosen-field"
            class="space-y-2 min-h-50 p-3 border-2 border-dashed rounded-xl transition-colors"
            :class="dragging
              ? 'border-indigo-300 bg-indigo-50/30'
              : 'border-gray-200 bg-gray-50/50'"
            @start="dragging = true"
            @end="dragging = false"
            @add="onCanvasAdd"
          >
            <CanvasFieldCard
              v-for="(field, index) in fields"
              :key="index"
              :field="field"
              :selected="selectedIndex === index"
              @select="selectedIndex = index"
              @remove="removeField(index)"
              @duplicate="duplicateField(index)"
            />
          </VueDraggable>

          <!-- Canvas empty state -->
          <div
            v-if="fields.length === 0 && !dragging"
            class="flex flex-col items-center justify-center py-10 text-gray-400 -mt-50"
          >
            <svg class="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p class="text-xs font-medium text-center">Drag fields here<br />to start building</p>
          </div>

          <!-- Toggleable live preview -->
          <div v-if="showPreview" class="mt-4">
            <FormPreview :schema="schema" />
          </div>
        </div>
      </div>

      <!-- Right: Properties sidebar (static, for selected field) -->
      <div class="w-80 shrink-0 border-l border-gray-200 pl-4 overflow-y-auto">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Properties</h2>

        <div v-if="selectedField && selectedIndex !== null">
          <FieldEditor
            :key="selectedIndex"
            :field="selectedField"
            :index="selectedIndex"
            @update="updateField(selectedIndex, $event)"
            @remove="removeField(selectedIndex); selectedIndex = null"
          />
        </div>

        <div
          v-else
          class="flex flex-col items-center justify-center py-16 text-gray-400"
        >
          <svg class="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          <p class="text-xs font-medium text-center">Select a field<br />to edit its properties</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ghost-field {
  opacity: 0.4;
  border: 2px dashed #6366f1;
  border-radius: 0.5rem;
}

.chosen-field {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
  border-radius: 0.5rem;
}
</style>
