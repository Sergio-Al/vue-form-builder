import { computed, type Ref } from 'vue'

let _nextId = 1
export function generateFieldId(): string {
  return `field_${_nextId++}_${Date.now().toString(36)}`
}

export interface FieldConfig {
  id: string
  name: string
  type: string
  label: string
  placeholder: string
  required: boolean
  options: { value: string; label: string }[]
  extraRules: string
  columns: number
  children?: FieldConfig[]
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
  { type: 'group', label: 'Section', icon: '📦' },
]

export function createEmptyField(type: string = 'text'): FieldConfig {
  const field: FieldConfig = {
    id: generateFieldId(),
    name: '',
    type,
    label: '',
    placeholder: '',
    required: false,
    options: [],
    extraRules: '',
    columns: 12,
  }
  if (type === 'group') field.children = []
  return field
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

function buildFieldEntry(field: FieldConfig): Record<string, any> | null {
  if (!field.name) return null

  if (field.type === 'group') {
    const childSchema: Record<string, any> = {}
    for (const child of field.children ?? []) {
      const childEntry = buildFieldEntry(child)
      if (childEntry) childSchema[child.name] = childEntry
    }
    const entry: Record<string, any> = { type: 'group', schema: childSchema }
    if (field.label) entry.label = field.label
    if (field.columns && field.columns !== 12) entry.columns = { container: field.columns }
    return entry
  }

  const mapper = TYPE_MAP[field.type]
  if (!mapper) return null

  const entry: Record<string, any> = mapper(field)

  if (field.label) entry.label = field.label
  if (field.placeholder && ['text', 'email', 'number', 'textarea', 'select'].includes(field.type)) {
    entry.placeholder = field.placeholder
  }

  const rules = buildRules(field)
  if (rules) entry.rules = rules

  if (field.columns && field.columns !== 12) entry.columns = { container: field.columns }

  return entry
}

export function useSchemaBuilder(fields: Ref<FieldConfig[]>) {
  const schema = computed(() => {
    const result: Record<string, any> = {}

    for (const field of fields.value) {
      const entry = buildFieldEntry(field)
      if (entry) result[field.name] = entry
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
  const entry = buildFieldEntry(field)
  if (!entry) return {}
  return { [key]: entry }
}

/** Convert a Vueform schema object back into FieldConfig[] for editing */
export function schemaToFields(schema: Record<string, any>): FieldConfig[] {
  const fields: FieldConfig[] = []

  for (const [name, config] of Object.entries(schema)) {
    if (config.type === 'button') continue

    // Parse columns (shared by all types)
    let columns = 12
    if (config.columns) {
      columns = typeof config.columns === 'object' ? config.columns.container ?? 12 : config.columns
    }

    // Handle group type
    if (config.type === 'group') {
      const children = config.schema ? schemaToFields(config.schema) : []
      fields.push({
        id: generateFieldId(),
        name,
        type: 'group',
        label: config.label || '',
        placeholder: '',
        required: false,
        options: [],
        extraRules: '',
        columns,
        children,
      })
      continue
    }

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
      id: generateFieldId(),
      name,
      type,
      label: config.label || '',
      placeholder: config.placeholder || '',
      required,
      options,
      extraRules,
      columns,
    })
  }

  return fields
}
