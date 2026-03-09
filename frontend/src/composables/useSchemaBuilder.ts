import { computed, type Ref } from 'vue'

export interface FieldConfig {
  name: string
  type: string
  label: string
  placeholder: string
  required: boolean
  options: { value: string; label: string }[]
  extraRules: string
}

export interface FieldTypeCatalogEntry {
  type: string
  label: string
  icon: string
}

export const FIELD_TYPE_CATALOG: FieldTypeCatalogEntry[] = [
  { type: 'text', label: 'Text', icon: '✏️' },
  { type: 'email', label: 'Email', icon: '📧' },
  { type: 'number', label: 'Number', icon: '🔢' },
  { type: 'textarea', label: 'Textarea', icon: '📝' },
  { type: 'select', label: 'Dropdown', icon: '📋' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️' },
  { type: 'checkboxgroup', label: 'Checkbox Group', icon: '✅' },
  { type: 'radiogroup', label: 'Radio Group', icon: '🔘' },
  { type: 'toggle', label: 'Toggle', icon: '🔀' },
  { type: 'date', label: 'Date', icon: '📅' },
  { type: 'file', label: 'File', icon: '📎' },
]

export function createEmptyField(type: string = 'text'): FieldConfig {
  return {
    name: '',
    type,
    label: '',
    placeholder: '',
    required: false,
    options: [],
    extraRules: '',
  }
}

const TYPE_MAP: Record<string, (field: FieldConfig) => Record<string, any>> = {
  text: () => ({ type: 'text' }),
  email: () => ({ type: 'text', inputType: 'email' }),
  number: () => ({ type: 'text', inputType: 'number' }),
  textarea: () => ({ type: 'textarea' }),
  select: (f) => ({ type: 'select', items: buildItems(f.options) }),
  checkbox: () => ({ type: 'checkbox' }),
  checkboxgroup: (f) => ({ type: 'checkboxgroup', items: buildItems(f.options) }),
  radiogroup: (f) => ({ type: 'radiogroup', items: buildItems(f.options) }),
  toggle: () => ({ type: 'toggle' }),
  date: () => ({ type: 'date' }),
  file: () => ({ type: 'file' }),
}

function buildItems(options: { value: string; label: string }[]): Record<string, string> {
  const items: Record<string, string> = {}
  for (const opt of options) {
    if (opt.value) items[opt.value] = opt.label || opt.value
  }
  return items
}

function buildRules(field: FieldConfig): string {
  const rules: string[] = []
  if (field.required) rules.push('required')
  if (field.type === 'email') rules.push('email')
  if (field.type === 'number') rules.push('numeric')
  if (field.extraRules) rules.push(field.extraRules)
  return rules.join('|')
}

export function useSchemaBuilder(fields: Ref<FieldConfig[]>) {
  const schema = computed(() => {
    const result: Record<string, any> = {}

    for (const field of fields.value) {
      if (!field.name) continue

      const mapper = TYPE_MAP[field.type]
      if (!mapper) continue

      const entry: Record<string, any> = mapper(field)

      if (field.label) entry.label = field.label
      if (field.placeholder && ['text', 'email', 'number', 'textarea', 'select'].includes(field.type)) {
        entry.placeholder = field.placeholder
      }

      const rules = buildRules(field)
      if (rules) entry.rules = rules

      result[field.name] = entry
    }

    // Always append submit button
    result.submit = {
      type: 'button',
      buttonLabel: 'Submit',
      submits: true,
    }

    return result
  })

  return { schema }
}

/** Build a Vueform schema for a single field (used by canvas preview cards) */
export function buildSingleFieldSchema(field: FieldConfig): Record<string, any> {
  const key = field.name || '_preview'
  const mapper = TYPE_MAP[field.type]
  if (!mapper) return {}

  const entry: Record<string, any> = mapper(field)
  if (field.label) entry.label = field.label
  if (field.placeholder && ['text', 'email', 'number', 'textarea', 'select'].includes(field.type)) {
    entry.placeholder = field.placeholder
  }
  return { [key]: entry }
}

/** Convert a Vueform schema object back into FieldConfig[] for editing */
export function schemaToFields(schema: Record<string, any>): FieldConfig[] {
  const fields: FieldConfig[] = []

  for (const [name, config] of Object.entries(schema)) {
    if (config.type === 'button') continue

    let type = config.type as string

    // Reverse-map special inputType cases
    if (config.type === 'text' && config.inputType === 'email') type = 'email'
    else if (config.type === 'text' && config.inputType === 'number') type = 'number'

    // Parse rules
    const rulesStr: string = config.rules || ''
    const rulesList = rulesStr.split('|').filter(Boolean)
    const required = rulesList.includes('required')
    const autoRules = ['required', 'email', 'numeric']
    const extraRules = rulesList.filter((r) => !autoRules.includes(r)).join('|')

    // Parse items → options
    const options: { value: string; label: string }[] = []
    if (config.items && typeof config.items === 'object') {
      for (const [value, label] of Object.entries(config.items)) {
        options.push({ value, label: label as string })
      }
    }

    fields.push({
      name,
      type,
      label: config.label || '',
      placeholder: config.placeholder || '',
      required,
      options,
      extraRules,
    })
  }

  return fields
}
