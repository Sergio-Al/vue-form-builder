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
  background: var(--node-bg);
  border: 1px solid var(--node-border);
  border-left: 4px solid var(--node-trigger-accent);
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
  color: var(--node-trigger-header-text);
  background: var(--node-trigger-header-bg);
  border-bottom: 1px solid var(--node-trigger-header-border);
  border-radius: 7px 7px 0 0;
}
.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--node-trigger-accent);
}
.node-body {
  padding: 8px 12px 10px;
}
.node-body label {
  display: block;
  font-size: 11px;
  color: var(--node-label);
  margin-bottom: 4px;
}
.node-select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--node-border);
  border-radius: 6px;
  font-size: 12px;
  background: var(--node-bg);
  color: var(--node-text);
}
.node-select:focus {
  outline: none;
  border-color: var(--node-trigger-accent);
  box-shadow: 0 0 0 2px var(--node-trigger-focus-shadow);
}
.event-badge {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  font-size: 10px;
  color: var(--node-trigger-header-text);
  background: var(--node-trigger-badge-bg);
  border-radius: 9999px;
}
</style>
