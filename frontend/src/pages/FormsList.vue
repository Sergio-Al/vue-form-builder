<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getForms, deleteForm, type FormSummary } from '@/services/api'

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
      <h1 class="text-2xl font-bold text-gray-900">My Forms</h1>
      <RouterLink
        to="/forms/new"
        class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
      >
        + Create New Form
      </RouterLink>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else-if="forms.length === 0" class="text-center py-12">
      <p class="text-gray-500 mb-4">No forms yet. Create your first form!</p>
      <RouterLink
        to="/forms/new"
        class="text-indigo-600 hover:text-indigo-800 font-medium"
      >
        Create a form →
      </RouterLink>
    </div>

    <div v-else class="grid gap-4">
      <div
        v-for="form in forms"
        :key="form.id"
        class="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">{{ form.name }}</h2>
            <p v-if="form.description" class="text-gray-500 text-sm mt-1">
              {{ form.description }}
            </p>
            <p class="text-gray-400 text-xs mt-2">Created {{ formatDate(form.createdAt) }}</p>
          </div>
          <div class="flex gap-2 ml-4 shrink-0">
            <RouterLink
              :to="`/forms/${form.id}/edit`"
              class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Edit
            </RouterLink>
            <a
              :href="`/f/${form.id}`"
              target="_blank"
              class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              View
            </a>
            <RouterLink
              :to="`/forms/${form.id}/responses`"
              class="px-3 py-1.5 text-sm border border-indigo-300 text-indigo-600 rounded hover:bg-indigo-50"
            >
              Responses
            </RouterLink>
            <button
              class="px-3 py-1.5 text-sm border border-red-200 text-red-500 rounded hover:bg-red-50"
              @click="handleDelete(form)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
