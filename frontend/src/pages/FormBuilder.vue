<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import CanvasFieldCard from '@/components/CanvasFieldCard.vue'
import CanvasGroupCard from '@/components/CanvasGroupCard.vue'
import FieldEditor from '@/components/FieldEditor.vue'
import FieldPalette from '@/components/FieldPalette.vue'
import FormPreview from '@/components/FormPreview.vue'
import {
  useSchemaBuilder,
  schemaToFields,
  createEmptyField,
  generateFieldId,
  type FieldConfig,
} from '@/composables/useSchemaBuilder'
import { createForm, updateForm, getForm } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const route = useRoute()
const router = useRouter()

const formName = ref('')
const formDescription = ref('')
const fields = ref<FieldConfig[]>([])
const saving = ref(false)
const loading = ref(false)
const dragging = ref(false)
const selectedPath = ref<{ parent: number; child?: number } | null>(null)
const showPreview = ref(false)
const showSchema = ref(false)
const schemaCopied = ref(false)

const selectedField = computed(() => {
  if (!selectedPath.value) return null
  const { parent, child } = selectedPath.value
  const parentField = fields.value[parent]
  if (!parentField) return null
  if (child != null) return parentField.children?.[child] ?? null
  return parentField
})

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
  if (!selectedPath.value) return

  const { parent, child } = selectedPath.value

  if (child != null) {
    const siblings = fields.value[parent]?.children ?? []
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedPath.value = { parent, child: Math.min(child + 1, siblings.length - 1) }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedPath.value = { parent, child: Math.max(child - 1, 0) }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeChildField(parent, child)
    }
  } else {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedPath.value = { parent: Math.min(parent + 1, fields.value.length - 1) }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedPath.value = { parent: Math.max(parent - 1, 0) }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeField(parent)
    }
  }
}

function onCanvasAdd(evt: { newIndex?: number }) {
  if (evt.newIndex == null) return
  const raw = fields.value[evt.newIndex]

  if (raw && !('name' in raw && 'label' in raw && 'options' in raw)) {
    // From palette — create proper field
    fields.value[evt.newIndex] = createEmptyField((raw as any).type)
  }

  selectedPath.value = { parent: evt.newIndex }
}

function updateField(path: { parent: number; child?: number }, field: FieldConfig) {
  if (path.child != null) {
    const parent = fields.value[path.parent]
    if (!parent?.children) return
    parent.children[path.child] = field
  } else {
    fields.value[path.parent] = field
  }
}

function removeField(index: number) {
  fields.value.splice(index, 1)
  if (fields.value.length === 0) {
    selectedPath.value = null
  } else if (selectedPath.value && selectedPath.value.child == null) {
    if (index === selectedPath.value.parent) {
      selectedPath.value = { parent: Math.min(index, fields.value.length - 1) }
    } else if (index < selectedPath.value.parent) {
      selectedPath.value = { parent: selectedPath.value.parent - 1 }
    }
  }
}

function removeChildField(parentIndex: number, childIndex: number) {
  const parent = fields.value[parentIndex]
  if (!parent?.children) return
  parent.children.splice(childIndex, 1)
  if (parent.children.length === 0) {
    selectedPath.value = { parent: parentIndex }
  } else {
    selectedPath.value = { parent: parentIndex, child: Math.min(childIndex, parent.children.length - 1) }
  }
}

function deepCloneField(original: FieldConfig): FieldConfig {
  const copy: FieldConfig = {
    id: generateFieldId(),
    name: original.name ? `${original.name}_copy` : '',
    type: original.type,
    label: original.label,
    placeholder: original.placeholder,
    required: original.required,
    options: original.options.map((o) => ({ ...o })),
    extraRules: original.extraRules,
    columns: original.columns,
  }
  if (original.children) {
    copy.children = original.children.map(deepCloneField)
  }
  return copy
}

function duplicateField(index: number) {
  const original = fields.value[index]
  if (!original) return
  const copy = deepCloneField(original)
  fields.value.splice(index + 1, 0, copy)
  selectedPath.value = { parent: index + 1 }
}

function updateGroupChildren(groupId: string, children: FieldConfig[]) {
  const parent = fields.value.find(f => f.id === groupId)
  if (!parent) return
  parent.children = children
}

function selectGroupChild(groupId: string, childIdx: number) {
  const groupIndex = fields.value.findIndex(f => f.id === groupId)
  if (groupIndex !== -1) {
    selectedPath.value = { parent: groupIndex, child: childIdx }
  }
}

function copySchema() {
  navigator.clipboard.writeText(JSON.stringify(schema.value, null, 2)).then(() => {
    schemaCopied.value = true
    setTimeout(() => (schemaCopied.value = false), 2000)
  })
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
  <div v-if="loading" class="text-center py-12 text-muted-foreground">Loading...</div>

  <div v-else class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-foreground">
        {{ isEdit ? 'Edit Form' : 'New Form' }}
      </h1>
      <div class="flex items-center gap-2">
        <Button
          v-if="isEdit && editId"
          variant="outline"
          size="sm"
          as-child
        >
          <RouterLink :to="`/forms/${editId}/rules`">Rules</RouterLink>
        </Button>
        <Button
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Saving...' : 'Save Form' }}
        </Button>
      </div>
    </div>

    <!-- Form metadata -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <label class="block text-sm font-medium text-foreground mb-1">Form Name</label>
        <Input
          v-model="formName"
          type="text"
          placeholder="e.g. Job Application"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-foreground mb-1">Description</label>
        <Input
          v-model="formDescription"
          type="text"
          placeholder="Optional description"
        />
      </div>
    </div>

    <!-- Three-column layout: palette | canvas | properties -->
    <div class="flex gap-0 flex-1 min-h-0">
      <!-- Left: Palette sidebar -->
      <div class="w-52 shrink-0 border-r border-border pr-4 overflow-y-auto">
        <FieldPalette />
      </div>

      <!-- Center: Canvas (drop zone + reorder) -->
      <div class="flex-1 min-w-0 px-6 overflow-y-auto">
        <div class="max-w-lg mx-auto">
          <!-- Canvas header -->
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Canvas</h2>
            <Button
              variant="ghost"
              size="sm"
              :class="showPreview ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
              @click="showPreview = !showPreview"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              :class="showSchema ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
              @click="showSchema = !showSchema"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              JSON Schema
            </Button>
          </div>

          <!-- Drop zone -->
          <VueDraggable
            v-model="fields"
            :group="{ name: 'fields', put: true }"
            :animation="200"
            handle=".drag-handle"
            ghost-class="ghost-field"
            chosen-class="chosen-field"
            class="grid grid-cols-12 gap-2 min-h-50 p-3 border-2 border-dashed rounded-xl transition-colors"
            :class="dragging
              ? 'border-ring bg-accent/30'
              : 'border-border bg-muted/50'"
            @start="dragging = true"
            @end="dragging = false"
            @add="onCanvasAdd"
          >
            <template v-for="(field, index) in fields" :key="field.id">
              <CanvasGroupCard
                v-if="field.type === 'group'"
                :field="field"
                :columns="field.columns ?? 12"
                :selected="selectedPath?.parent === index && selectedPath?.child == null"
                :selected-child-index="selectedPath?.parent === index ? selectedPath?.child ?? null : null"
                data-group-card="true"
                @select="selectedPath = { parent: index }"
                @remove="removeField(index)"
                @duplicate="duplicateField(index)"
                @select-child="(childIdx: number) => selectGroupChild(field.id, childIdx)"
                @update-children="(children: FieldConfig[]) => updateGroupChildren(field.id, children)"
              />
              <CanvasFieldCard
                v-else
                :field="field"
                :columns="field.columns ?? 12"
                :selected="selectedPath?.parent === index && selectedPath?.child == null"
                @select="selectedPath = { parent: index }"
                @remove="removeField(index)"
                @duplicate="duplicateField(index)"
              />
            </template>
          </VueDraggable>

          <!-- Canvas empty state -->
          <div
            v-if="fields.length === 0 && !dragging"
            class="flex flex-col items-center justify-center py-10 text-muted-foreground -mt-50"
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

          <!-- Toggleable JSON schema viewer -->
          <div v-if="showSchema" class="mt-4">
            <div class="bg-secondary rounded-xl overflow-hidden border border-border">
              <div class="flex items-center justify-between px-4 py-2 border-b border-border">
                <span class="text-xs font-medium text-muted-foreground">JSON Schema</span>
                <Button
                  variant="ghost"
                  size="sm"
                  :class="schemaCopied ? 'text-green-500' : 'text-muted-foreground'"
                  @click="copySchema"
                >
                  {{ schemaCopied ? 'Copied!' : 'Copy' }}
                </Button>
              </div>
              <pre class="p-4 text-sm text-foreground overflow-x-auto max-h-96 overflow-y-auto">{{ JSON.stringify(schema, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Properties sidebar (static, for selected field) -->
      <div class="w-80 shrink-0 border-l border-border pl-4 overflow-y-auto">
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Properties</h2>

        <div v-if="selectedField && selectedPath !== null">
          <FieldEditor
            :key="`${selectedPath.parent}-${selectedPath.child ?? 'root'}`"
            :field="selectedField"
            :index="selectedPath.child ?? selectedPath.parent"
            @update="updateField(selectedPath, $event)"
            @remove="() => {
              if (selectedPath!.child != null) {
                removeChildField(selectedPath!.parent, selectedPath!.child)
              } else {
                removeField(selectedPath!.parent)
                selectedPath = null
              }
            }"
          />
        </div>

        <div
          v-else
          class="flex flex-col items-center justify-center py-16 text-muted-foreground"
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
:deep(.ghost-field) {
  opacity: 0.4;
  border: 2px dashed hsl(var(--ring));
  border-radius: 0.5rem;
  grid-column: span 12 !important;
  min-height: 3rem;
}

:deep(.chosen-field) {
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.3);
  border-radius: 0.5rem;
}
</style>
