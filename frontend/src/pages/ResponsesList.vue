<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getForm, getResponses, type FormDetail, type FormResponse } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

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
    <div v-if="loading" class="text-center py-12 text-muted-foreground">Loading...</div>

    <div v-else-if="form">
      <div class="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" size="sm" as-child class="px-0 text-muted-foreground hover:text-foreground">
            <RouterLink to="/forms">← Back to Forms</RouterLink>
          </Button>
          <h1 class="text-2xl font-bold text-foreground mt-1">
            {{ form.name }} — Responses
          </h1>
          <p class="text-muted-foreground text-sm">{{ responses.length }} response(s)</p>
        </div>
      </div>

      <div v-if="responses.length === 0" class="text-center py-12">
        <p class="text-muted-foreground">No responses yet.</p>
      </div>

      <Card v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead v-for="col in columns" :key="col.key">
                {{ col.label }}
              </TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(resp, idx) in responses" :key="resp.id">
              <TableCell class="text-muted-foreground">{{ idx + 1 }}</TableCell>
              <TableCell v-for="col in columns" :key="col.key">
                {{ displayValue(getNestedValue(resp.data, col.key)) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(resp.createdAt) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  </div>
</template>
