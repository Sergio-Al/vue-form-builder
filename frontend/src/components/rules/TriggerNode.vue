<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  id: string
  data: {
    field: string
    event: string
    fieldNames: string[]
  }
}>()
</script>

<template>
  <div class="trigger-node">
    <div class="node-header">
      <span class="header-dot" />
      Trigger
    </div>
    <div class="node-body">
      <label>When field</label>
      <select v-model="data.field" class="node-select">
        <option value="" disabled>Select field…</option>
        <option v-for="f in data.fieldNames" :key="f" :value="f">{{ f }}</option>
      </select>
      <span class="event-badge">on change</span>
    </div>
    <Handle type="source" :position="Position.Right" id="output" />
  </div>
</template>

<style scoped>
.trigger-node {
  background: white;
  border: 1px solid #d1d5db;
  border-left: 4px solid #22c55e;
  border-radius: 8px;
  min-width: 200px;
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
  color: #166534;
  background: #f0fdf4;
  border-bottom: 1px solid #dcfce7;
  border-radius: 7px 7px 0 0;
}
.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
}
.node-body {
  padding: 8px 12px 10px;
}
.node-body label {
  display: block;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}
.node-select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  background: white;
  color: #374151;
}
.node-select:focus {
  outline: none;
  border-color: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
}
.event-badge {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  font-size: 10px;
  color: #166534;
  background: #dcfce7;
  border-radius: 9999px;
}
</style>
