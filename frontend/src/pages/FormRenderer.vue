<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getForm, submitResponse } from '@/services/api'

const route = useRoute()
const formId = route.params.id as string

const form = ref<{ name: string; description: string | null; schema: Record<string, any> } | null>(null)
const loading = ref(true)
const error = ref('')
const submitted = ref(false)

onMounted(async () => {
  try {
    const { data } = await getForm(formId)
    form.value = data
  } catch {
    error.value = 'Form not found'
  } finally {
    loading.value = false
  }
})

async function handleSubmit(form$: any) {
  try {
    await submitResponse(formId, form$.requestData)
    submitted.value = true
    form$.reset()
  } catch {
    form$.messageBag.append('Failed to submit form. Please try again.', 'error')
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div v-if="loading" class="text-center py-12 text-gray-500">Loading form...</div>

    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-500 text-lg">{{ error }}</p>
    </div>

    <div v-else-if="submitted" class="text-center py-12">
      <div class="bg-green-50 border border-green-200 rounded-lg p-8">
        <h2 class="text-2xl font-bold text-green-800 mb-2">Thank you!</h2>
        <p class="text-green-600">Your response has been submitted successfully.</p>
        <button
          class="mt-4 text-sm text-indigo-600 hover:text-indigo-800 underline"
          @click="submitted = false"
        >
          Submit another response
        </button>
      </div>
    </div>

    <div v-else-if="form">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">{{ form.name }}</h1>
        <p v-if="form.description" class="text-gray-600 mt-1">{{ form.description }}</p>
      </div>

      <div class="form-card bg-white border border-gray-200 rounded-xl shadow-sm p-8">
        <Vueform
          :schema="form.schema"
          :endpoint="false"
          @submit="handleSubmit"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Field spacing */
.form-card :deep(.vf-element) {
  margin-bottom: 1.5rem;
}

.form-card :deep(.vf-element:last-child) {
  margin-bottom: 0;
}

/* Labels */
.form-card :deep(label) {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
  display: block;
}

/* Checkboxes & radio labels — inline, normal weight */
.form-card :deep(.vf-checkbox-label),
.form-card :deep(.vf-radio-label) {
  display: inline;
  font-weight: 400;
}
</style>
