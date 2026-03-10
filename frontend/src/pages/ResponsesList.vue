<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getForm, getResponses, type FormDetail, type FormResponse } from '@/services/api'

const route = useRoute()
const formId = route.params.id as string

const form = ref<FormDetail | null>(null)
const responses = ref<FormResponse[]>([])
const loading = ref(true)

const columns = computed(() => {
  if (!form.value?.schema) return []
  return flattenSchemaColumns(form.value.schema)
})

function flattenSchemaColumns(
  schema: Record<string, any>,
  prefix = '',
  parentLabel = '',
): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = []
  for (const [name, config] of Object.entries(schema)) {
    if ((config as any).type === 'button') continue
    const fullKey = prefix ? `${prefix}.${name}` : name
    if ((config as any).type === 'group' && (config as any).schema) {
      const groupLabel = (config as any).label || name
      result.push(...flattenSchemaColumns((config as any).schema, fullKey, groupLabel))
    } else {
      const fieldLabel = (config as any).label || name
      const label = parentLabel ? `${parentLabel} › ${fieldLabel}` : fieldLabel
      result.push({ key: fullKey, label })
    }
  }
  return result
}

onMounted(async () => {
  try {
    const [formRes, respRes] = await Promise.all([
      getForm(formId),
      getResponses(formId),
    ])
    form.value = formRes.data
    responses.value = respRes.data
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function displayValue(value: any): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function getNestedValue(data: Record<string, any>, path: string): any {
  return path.split('.').reduce((obj, key) => obj?.[key], data)
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else-if="form">
      <div class="flex items-center justify-between mb-6">
        <div>
          <RouterLink to="/forms" class="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Forms
          </RouterLink>
          <h1 class="text-2xl font-bold text-gray-900 mt-1">
            {{ form.name }} — Responses
          </h1>
          <p class="text-gray-500 text-sm">{{ responses.length }} response(s)</p>
        </div>
      </div>

      <div v-if="responses.length === 0" class="text-center py-12">
        <p class="text-gray-500">No responses yet.</p>
      </div>

      <div v-else class="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                #
              </th>
              <th
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {{ col.label }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="(resp, idx) in responses" :key="resp.id">
              <td class="px-4 py-3 text-sm text-gray-500">{{ idx + 1 }}</td>
              <td
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3 text-sm text-gray-900"
              >
                {{ displayValue(getNestedValue(resp.data, col.key)) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">
                {{ formatDate(resp.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
