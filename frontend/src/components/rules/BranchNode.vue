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
  background: var(--node-bg);
  border: 1px solid var(--node-border);
  border-left: 4px solid var(--node-branch-accent);
  border-radius: 8px;
  min-width: 140px;
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
  color: var(--node-branch-header-text);
  background: var(--node-branch-header-bg);
  border-bottom: 1px solid var(--node-branch-header-border);
  border-radius: 7px 7px 0 0;
}
.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--node-branch-accent);
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
  color: var(--node-branch-true-text);
  font-weight: 500;
}
.branch-false {
  font-size: 12px;
  color: var(--node-branch-false-text);
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
  color: var(--node-handle-true-text);
  background: var(--node-handle-true-bg);
}
.handle-false {
  color: var(--node-handle-false-text);
  background: var(--node-handle-false-bg);
}
</style>
