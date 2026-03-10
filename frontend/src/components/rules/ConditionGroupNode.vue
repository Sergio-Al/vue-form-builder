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
    operator: 'and' | 'or'
    conditions: { field: string; op: string; value: any }[]
    fieldNames: string[]
  }
}>()

function addCondition() {
  props.data.conditions.push({ field: '', op: 'eq', value: '' })
}

function removeCondition(index: number) {
  if (props.data.conditions.length > 1) {
    props.data.conditions.splice(index, 1)
  }
}

function needsValue(op: string) {
  return !['is_empty', 'is_not_empty'].includes(op)
}
</script>

<template>
  <div class="condition-group-node">
    <div class="node-header">
      <span class="header-dot" />
      Conditions
      <div class="operator-toggle">
        <button
          class="toggle-btn"
          :class="{ active: data.operator === 'and' }"
          @click="data.operator = 'and'"
        >AND</button>
        <button
          class="toggle-btn"
          :class="{ active: data.operator === 'or' }"
          @click="data.operator = 'or'"
        >OR</button>
      </div>
    </div>
    <div class="node-body">
      <div
        v-for="(cond, i) in data.conditions"
        :key="i"
        class="condition-row"
      >
        <select v-model="cond.field" class="node-select field-select">
          <option value="" disabled>Field…</option>
          <option v-for="f in data.fieldNames" :key="f" :value="f">{{ f }}</option>
        </select>
        <select v-model="cond.op" class="node-select op-select">
          <option v-for="op in OPERATORS" :key="op.value" :value="op.value">{{ op.label }}</option>
        </select>
        <input
          v-if="needsValue(cond.op)"
          v-model="cond.value"
          class="node-input value-input"
          placeholder="Value…"
        />
        <button
          v-if="data.conditions.length > 1"
          class="remove-btn"
          @click="removeCondition(i)"
          title="Remove condition"
        >×</button>
      </div>
      <button class="add-btn" @click="addCondition">+ Add condition</button>
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
.condition-group-node {
  position: relative;
  background: white;
  border: 1px solid #d1d5db;
  border-left: 4px solid #f59e0b;
  border-radius: 8px;
  min-width: 320px;
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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
  color: #92400e;
  background: #fffbeb;
  border-bottom: 1px solid #fef3c7;
  border-radius: 7px 7px 0 0;
}
.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
}
.operator-toggle {
  margin-left: auto;
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}
.toggle-btn {
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  background: white;
  border: none;
  cursor: pointer;
  color: #6b7280;
}
.toggle-btn.active {
  background: #f59e0b;
  color: white;
}
.node-body {
  padding: 8px 12px 10px;
}
.condition-row {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-bottom: 6px;
}
.condition-row:last-of-type {
  margin-bottom: 0;
}
.node-select,
.node-input {
  padding: 5px 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 11px;
  background: white;
  color: #374151;
}
.node-select:focus,
.node-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
}
.field-select {
  flex: 1;
  min-width: 0;
}
.op-select {
  width: 90px;
  flex-shrink: 0;
}
.value-input {
  width: 70px;
  flex-shrink: 0;
}
.remove-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}
.remove-btn:hover {
  background: #fecaca;
}
.add-btn {
  margin-top: 6px;
  padding: 3px 8px;
  font-size: 11px;
  color: #92400e;
  background: #fffbeb;
  border: 1px dashed #fcd34d;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
}
.add-btn:hover {
  background: #fef3c7;
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
  color: #166534;
  background: #dcfce7;
}
.handle-false {
  color: #991b1b;
  background: #fee2e2;
}
</style>
