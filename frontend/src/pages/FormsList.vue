<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getForms, deleteForm, type FormSummary } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const forms = ref<FormSummary[]>([])
const loading = ref(true)

onMounted(loadForms)

async function loadForms() {
  loading.value = true
  try {
    const { data } = await getForms()
    forms.value = data
  } finally {
    loading.value = false
  }
}

async function handleDelete(form: FormSummary) {
  if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return
  await deleteForm(form.id)
  forms.value = forms.value.filter((f) => f.id !== form.id)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-foreground">My Forms</h1>
      <Button as-child>
        <RouterLink to="/forms/new">+ Create New Form</RouterLink>
      </Button>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted-foreground">Loading...</div>

    <div v-else-if="forms.length === 0" class="text-center py-12">
      <p class="text-muted-foreground mb-4">No forms yet. Create your first form!</p>
      <RouterLink
        to="/forms/new"
        class="text-foreground hover:text-foreground/80 font-medium"
      >
        Create a form →
      </RouterLink>
    </div>

    <div v-else class="grid gap-4">
      <Card
        v-for="form in forms"
        :key="form.id"
        class="p-5 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold text-foreground">{{ form.name }}</h2>
            <p v-if="form.description" class="text-muted-foreground text-sm mt-1">
              {{ form.description }}
            </p>
            <p class="text-muted-foreground/60 text-xs mt-2">Created {{ formatDate(form.createdAt) }}</p>
          </div>
          <div class="flex gap-2 ml-4 shrink-0">
            <Button variant="outline" size="sm" as-child>
              <RouterLink :to="`/forms/${form.id}/edit`">Edit</RouterLink>
            </Button>
            <Button variant="outline" size="sm" as-child>
              <a :href="`/f/${form.id}`" target="_blank">View</a>
            </Button>
            <Button variant="outline" size="sm" as-child>
              <RouterLink :to="`/forms/${form.id}/rules`">Rules</RouterLink>
            </Button>
            <Button variant="secondary" size="sm" as-child>
              <RouterLink :to="`/forms/${form.id}/responses`">Responses</RouterLink>
            </Button>
            <Button variant="destructive" size="sm" @click="handleDelete(form)">
              Delete
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
