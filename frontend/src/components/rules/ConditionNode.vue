<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'in', label: 'in list' },
  { value: 'not_in', label: 'not in list' },
] as const

const props = defineProps<{
  id: string
  data: {
    field: string
    op: string
    value: any
    fieldNames: string[]
  }
}>()

const needsValue = computed(() => !['is_empty', 'is_not_empty'].includes(props.data.op))
</script>

<template>
  <div class="condition-node">
    <div class="node-header">
      <span class="header-dot" />
      Condition
    </div>
    <div class="node-body">
      <select v-model="data.field" class="node-select">
        <option value="" disabled>Field…</option>
        <option v-for="f in data.fieldNames" :key="f" :value="f">{{ f }}</option>
      </select>
      <select v-model="data.op" class="node-select mt-1">
        <option v-for="op in OPERATORS" :key="op.value" :value="op.value">{{ op.label }}</option>
      </select>
      <input
        v-if="needsValue"
        v-model="data.value"
        class="node-input mt-1"
        placeholder="Value…"
      />
    </div>
    <Handle type="target" :position="Position.Left" id="input" />
    <Handle
      type="source"
      :position="Position.Right"
      id="true"
      :style="{ top: '40%' }"
    />
    <Handle
      type="source"
      :position="Position.Right"
      id="false"
      :style="{ top: '75%' }"
    />
    <span class="handle-label handle-true" style="top: 40%">✓</span>
    <span class="handle-label handle-false" style="top: 75%">✗</span>
  </div>
</template>

<style scoped>
.condition-node {
  position: relative;
  background: var(--node-bg);
  border: 1px solid var(--node-border);
  border-left: 4px solid var(--node-condition-accent);
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
  color: var(--node-condition-header-text);
  background: var(--node-condition-header-bg);
  border-bottom: 1px solid var(--node-condition-header-border);
  border-radius: 7px 7px 0 0;
}
.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--node-condition-accent);
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
  border-color: var(--node-condition-accent);
  box-shadow: 0 0 0 2px var(--node-condition-focus-shadow);
}
.mt-1 {
  margin-top: 4px;
}
.handle-label {
  position: absolute;
  right: -20px;
  transform: translateY(-50%);
  font-size: 10px;
  font-weight: 700;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  pointer-events: none;
}
.handle-true {
  color: var(--node-handle-true-text);
  background: var(--node-handle-true-bg);
}
.handle-false {
  color: var(--node-handle-false-text);
  background: var(--node-handle-false-bg);
}
</style>
