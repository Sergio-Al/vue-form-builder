<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getForm, submitResponse } from '@/services/api'
import { useRulesEngine, injectConditionsIntoSchema } from '@/composables/useRulesEngine'
import type { Rule } from '@/types/rules'

const route = useRoute()
const formId = route.params.id as string

const form = ref<{ name: string; description: string | null; schema: Record<string, any>; rules?: Record<string, any>[] } | null>(null)
const formData = ref<Record<string, any>>({})
const loading = ref(true)
const error = ref('')
const submitted = ref(false)

// Rules engine state (initialised after form loads)
const rulesEngine = ref<ReturnType<typeof useRulesEngine> | null>(null)
// Schema with Vueform-native conditions injected (Phase 3)
const injectedSchema = ref<Record<string, any> | null>(null)
// Fields whose show/hide is handled natively by Vueform conditions
const nativeVisibilityFields = ref<Set<string>>(new Set())

onMounted(async () => {
  try {
    const { data } = await getForm(formId)
    form.value = data

    const rules = (data.rules ?? []) as Rule[]
    if (rules.length > 0) {
      // Phase 3: inject native Vueform conditions for simple show/hide rules
      const { schema: enriched, nativeRuleIds } = injectConditionsIntoSchema(
        data.schema,
        rules,
      )
      injectedSchema.value = enriched

      // Collect the fields handled natively so the imperative engine skips them
      for (const rule of rules) {
        if (nativeRuleIds.has(rule.id)) {
          for (const action of rule.actions) {
            nativeVisibilityFields.value.add(action.target)
          }
        }
      }

      // Only pass non-native rules to the imperative engine
      const imperativeRules = rules.filter((r) => !nativeRuleIds.has(r.id))
      if (imperativeRules.length > 0) {
        rulesEngine.value = useRulesEngine(imperativeRules, formData.value)
      }
    }
  } catch {
    error.value = 'Form not found'
  } finally {
    loading.value = false
  }
})

/**
 * Build a modified schema that applies visibility, required, disabled,
 * and options overrides from the rules engine.
 */
const enhancedSchema = computed(() => {
  if (!form.value) return {}
  // Use native-injected schema when available, raw schema otherwise
  const base = injectedSchema.value ?? form.value.schema
  if (!rulesEngine.value) return base

  const { visibilityMap, requiredMap, disabledMap, optionsMap } = rulesEngine.value
  const schema: Record<string, any> = {}

  for (const [key, field] of Object.entries(base)) {
    const copy = { ...field }

    // Visibility — skip fields handled by Vueform-native conditions
    if (key in visibilityMap && !nativeVisibilityFields.value.has(key)) {
      if (!visibilityMap[key]) {
        copy.conditions = [['__always_false__', '==', '__never__']]
      }
    }

    // Required
    if (key in requiredMap) {
      const currentRules: string = copy.rules ?? ''
      const parts = currentRules.split('|').filter((r: string) => r && r !== 'required')
      if (requiredMap[key]) parts.unshift('required')
      copy.rules = parts.join('|') || undefined
    }

    // Disabled
    if (key in disabledMap) {
      copy.disabled = disabledMap[key]
    }

    // Options
    if (key in optionsMap) {
      copy.items = optionsMap[key]
    }

    schema[key] = copy
  }

  return schema
})

function handleFieldChange(newValue: any, oldValue: any, el$: any) {
  if (!rulesEngine.value) return
  rulesEngine.value.onFieldChange(el$.name, newValue)
}

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
          :schema="enhancedSchema"
          :endpoint="false"
          @change="handleFieldChange"
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
