<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const ACTION_TYPES = [
  { value: 'set_value', label: 'Set value', needsValue: true },
  { value: 'clear_value', label: 'Clear value', needsValue: false },
  { value: 'show', label: 'Show field', needsValue: false },
  { value: 'hide', label: 'Hide field', needsValue: false },
  { value: 'set_required', label: 'Make required', needsValue: false },
  { value: 'remove_required', label: 'Remove required', needsValue: false },
  { value: 'set_options', label: 'Set options', needsValue: true },
  { value: 'disable', label: 'Disable field', needsValue: false },
  { value: 'enable', label: 'Enable field', needsValue: false },
] as const

const props = defineProps<{
  id: string
  data: {
    actionType: string
    target: string
    value: any
    fieldNames: string[]
  }
}>()

const needsValue = computed(() => {
  const entry = ACTION_TYPES.find((a) => a.value === props.data.actionType)
  return entry?.needsValue ?? false
})
</script>

<template>
  <div class="action-node">
    <div class="node-header">
      <span class="header-dot" />
      Action
    </div>
    <div class="node-body">
      <select v-model="data.actionType" class="node-select">
        <option value="" disabled>Action type…</option>
        <option v-for="a in ACTION_TYPES" :key="a.value" :value="a.value">{{ a.label }}</option>
      </select>
      <select v-model="data.target" class="node-select mt-1">
        <option value="" disabled>Target field…</option>
        <option v-for="f in data.fieldNames" :key="f" :value="f">{{ f }}</option>
      </select>
      <input
        v-if="needsValue"
        v-model="data.value"
        class="node-input mt-1"
        placeholder="Value…"
      />
    </div>
    <Handle type="target" :position="Position.Left" id="input" />
  </div>
</template>

<style scoped>
.action-node {
  background: var(--node-bg);
  border: 1px solid var(--node-border);
  border-left: 4px solid var(--node-action-accent);
  border-radius: 8px;
  min-width: 200px;
  font-size: 13px;
  box-shadow: 0 1px 3px var(--node-shadow);
}
.node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--node-action-header-text);
  background: var(--node-action-header-bg);
  border-bottom: 1px solid var(--node-action-header-border);
  border-radius: 7px 7px 0 0;
}
.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--node-action-accent);
}
.node-body {
  padding: 8px 12px 10px;
}
.node-select,
.node-input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--node-border);
  border-radius: 6px;
  font-size: 12px;
  background: var(--node-bg);
  color: var(--node-text);
}
.node-select:focus,
.node-input:focus {
  outline: none;
  border-color: var(--node-action-accent);
  box-shadow: 0 0 0 2px var(--node-action-focus-shadow);
}
.mt-1 {
  margin-top: 4px;
}
</style>
