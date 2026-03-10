<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  id: string
  data: Record<string, any>
}>()
</script>

<template>
  <div class="branch-node">
    <div class="node-header">
      <span class="header-dot" />
      Branch
    </div>
    <div class="node-body">
      <div class="branch-label">
        <span class="branch-true">If true →</span>
        <span class="branch-false">If false →</span>
      </div>
    </div>
    <Handle type="target" :position="Position.Left" id="input" />
    <Handle
      type="source"
      :position="Position.Right"
      id="true"
      :style="{ top: '35%' }"
    />
    <Handle
      type="source"
      :position="Position.Right"
      id="false"
      :style="{ top: '70%' }"
    />
    <span class="handle-label handle-true" style="top: 35%">✓</span>
    <span class="handle-label handle-false" style="top: 70%">✗</span>
  </div>
</template>

<style scoped>
.branch-node {
  position: relative;
  background: white;
  border: 1px solid #d1d5db;
  border-left: 4px solid #a855f7;
  border-radius: 8px;
  min-width: 140px;
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
  color: #6b21a8;
  background: #faf5ff;
  border-bottom: 1px solid #f3e8ff;
  border-radius: 7px 7px 0 0;
}
.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a855f7;
}
.node-body {
  padding: 8px 12px 10px;
}
.branch-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.branch-true {
  font-size: 12px;
  color: #166534;
  font-weight: 500;
}
.branch-false {
  font-size: 12px;
  color: #991b1b;
  font-weight: 500;
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
