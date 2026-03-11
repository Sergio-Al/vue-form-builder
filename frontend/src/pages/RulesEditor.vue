<script setup lang="ts">
import { ref, computed, onMounted, markRaw, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { Node, Edge, Connection } from '@vue-flow/core'

import TriggerNode from '@/components/rules/TriggerNode.vue'
import ConditionNode from '@/components/rules/ConditionNode.vue'
import ConditionGroupNode from '@/components/rules/ConditionGroupNode.vue'
import ActionNode from '@/components/rules/ActionNode.vue'
import BranchNode from '@/components/rules/BranchNode.vue'

import { getForm, updateForm } from '@/services/api'
import type { Rule, RuleFlowMeta } from '@/types/rules'
import {
  ruleToFlow,
  flowToRule,
  createDefaultFlow,
  validateFlow,
  validateNoCycles,
  restoreFlowMeta,
} from '@/composables/useRuleSerializer'
import { Button } from '@/components/ui/button'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const route = useRoute()
const router = useRouter()
const formId = route.params.id as string

const nodeTypes = {
  trigger: markRaw(TriggerNode),
  condition: markRaw(ConditionNode),
  conditionGroup: markRaw(ConditionGroupNode),
  action: markRaw(ActionNode),
  branch: markRaw(BranchNode),
}

// ── State ───────────────────────────────────────────────────────

const loading = ref(true)
const saving = ref(false)
const formName = ref('')
const formSchema = ref<Record<string, any>>({})
const rules = ref<(Rule & { flowMeta?: RuleFlowMeta })[]>([])
const selectedIndex = ref<number>(-1)
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const saveMessage = ref('')

const fieldNames = computed(() => {
  return extractFieldNames(formSchema.value)
})

function extractFieldNames(
  schema: Record<string, any>,
  prefix = '',
): string[] {
  const names: string[] = []
  for (const [key, config] of Object.entries(schema)) {
    if (config.type === 'button') continue
    const fullKey = prefix ? `${prefix}.${key}` : key
    names.push(fullKey)
    if (config.type === 'group' && config.schema) {
      names.push(...extractFieldNames(config.schema, fullKey))
    }
  }
  return names
}

// ── Load form ───────────────────────────────────────────────────

onMounted(async () => {
  try {
    const { data } = await getForm(formId)
    formName.value = data.name
    formSchema.value = data.schema
    rules.value = (data.rules ?? []) as (Rule & { flowMeta?: RuleFlowMeta })[]
    if (rules.value.length > 0) {
      selectRule(0)
    }
  } catch {
    router.push('/forms')
  } finally {
    loading.value = false
  }
})

// ── Rule selection ──────────────────────────────────────────────

function selectRule(index: number) {
  // Save current flow state before switching
  if (selectedIndex.value >= 0 && selectedIndex.value < rules.value.length) {
    persistCurrentFlow()
  }

  selectedIndex.value = index
  const rule = rules.value[index]
  if (!rule) return

  // Restore from flowMeta if available, otherwise generate from rule
  if (rule.flowMeta?.nodes?.length) {
    nodes.value = restoreFlowMeta(rule.flowMeta.nodes, fieldNames.value)
    edges.value = [...rule.flowMeta.edges]
  } else {
    const flow = ruleToFlow(rule, fieldNames.value)
    nodes.value = flow.nodes
    edges.value = flow.edges
  }
}

function persistCurrentFlow() {
  const idx = selectedIndex.value
  if (idx < 0 || idx >= rules.value.length) return

  try {
    const rule = rules.value[idx]
    const updated = flowToRule(nodes.value, edges.value, rule.id, rule.name, rule.enabled)
    // Preserve flow meta for visual layout
    const cleanNodes = nodes.value.map((n) => {
      const { fieldNames: _, ...data } = n.data
      return { ...n, data }
    })
    rules.value[idx] = {
      ...updated,
      flowMeta: { ruleId: rule.id, nodes: cleanNodes, edges: [...edges.value] },
    }
  } catch {
    // If serialization fails, just save the flow meta
    const rule = rules.value[idx]
    const cleanNodes = nodes.value.map((n) => {
      const { fieldNames: _, ...data } = n.data
      return { ...n, data }
    })
    rule.flowMeta = { ruleId: rule.id, nodes: cleanNodes, edges: [...edges.value] }
  }
}

// ── Rule management ─────────────────────────────────────────────

function addRule() {
  const id = crypto.randomUUID()
  const newRule: Rule & { flowMeta?: RuleFlowMeta } = {
    id,
    name: `Rule ${rules.value.length + 1}`,
    enabled: true,
    trigger: { field: '', event: 'change' },
    conditions: { operator: 'and', items: [] },
    actions: [],
    elseActions: [],
  }
  rules.value.push(newRule)
  selectRule(rules.value.length - 1)
}

function deleteRule(index: number) {
  rules.value.splice(index, 1)
  if (rules.value.length === 0) {
    selectedIndex.value = -1
    nodes.value = []
    edges.value = []
  } else {
    selectRule(Math.min(index, rules.value.length - 1))
  }
}

function toggleRule(index: number) {
  rules.value[index].enabled = !rules.value[index].enabled
}

// ── Canvas: adding nodes ────────────────────────────────────────

let nodeCounter = 0

function addConditionGroupNode() {
  const id = `cond-new-${++nodeCounter}-${Date.now()}`
  nodes.value.push({
    id,
    type: 'conditionGroup',
    position: { x: 330, y: 100 + nodes.value.length * 40 },
    data: {
      operator: 'and',
      conditions: [{ field: '', op: 'eq', value: '' }],
      fieldNames: fieldNames.value,
    },
  })
}

function addConditionNode() {
  const id = `cond-s-${++nodeCounter}-${Date.now()}`
  nodes.value.push({
    id,
    type: 'condition',
    position: { x: 330, y: 100 + nodes.value.length * 40 },
    data: {
      field: '',
      op: 'eq',
      value: '',
      fieldNames: fieldNames.value,
    },
  })
}

function addActionNode() {
  const id = `action-new-${++nodeCounter}-${Date.now()}`
  nodes.value.push({
    id,
    type: 'action',
    position: { x: 700, y: 100 + nodes.value.length * 40 },
    data: {
      actionType: '',
      target: '',
      value: '',
      fieldNames: fieldNames.value,
    },
  })
}

function addBranchNode() {
  const id = `branch-${++nodeCounter}-${Date.now()}`
  nodes.value.push({
    id,
    type: 'branch',
    position: { x: 520, y: 130 + nodes.value.length * 40 },
    data: { fieldNames: fieldNames.value },
  })
}

// ── Canvas: connecting nodes ────────────────────────────────────

function onConnect(connection: Connection) {
  const edgeId = `e-${connection.source}-${connection.sourceHandle ?? 'out'}-${connection.target}`
  // Prevent duplicate edges
  if (edges.value.some((e) => e.id === edgeId)) return

  const edge: Edge = {
    id: edgeId,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
  }

  if (connection.sourceHandle === 'true') {
    edge.style = { stroke: '#22c55e' }
    edge.label = 'True'
  } else if (connection.sourceHandle === 'false') {
    edge.style = { stroke: '#ef4444' }
    edge.label = 'False'
  } else {
    edge.animated = true
  }

  edges.value.push(edge)
}

// ── Save ────────────────────────────────────────────────────────

async function saveRules() {
  // Persist current flow
  persistCurrentFlow()

  // Validate each rule's flow
  for (let i = 0; i < rules.value.length; i++) {
    const rule = rules.value[i]
    if (!rule.flowMeta?.nodes?.length) {
      // Re-generate flow for validation if needed
      const flow =
        rule.trigger.field || rule.actions.length
          ? ruleToFlow(rule, fieldNames.value)
          : createDefaultFlow(rule.id, fieldNames.value)
      const flowErrors = validateFlow(flow.nodes, flow.edges)
      if (flowErrors.length > 0) {
        saveMessage.value = `Rule "${rule.name}": ${flowErrors[0].message}`
        setTimeout(() => (saveMessage.value = ''), 4000)
        selectRule(i)
        return
      }
    } else {
      const restNodes = restoreFlowMeta(rule.flowMeta.nodes, fieldNames.value)
      const flowErrors = validateFlow(restNodes, rule.flowMeta.edges)
      if (flowErrors.length > 0) {
        saveMessage.value = `Rule "${rule.name}": ${flowErrors[0].message}`
        setTimeout(() => (saveMessage.value = ''), 4000)
        selectRule(i)
        return
      }
    }
  }

  // Cross-rule cycle detection
  const cycleErrors = validateNoCycles(rules.value)
  if (cycleErrors.length > 0) {
    saveMessage.value = cycleErrors[0]
    setTimeout(() => (saveMessage.value = ''), 4000)
    return
  }

  saving.value = true
  try {
    await updateForm(formId, { rules: rules.value })
    saveMessage.value = 'Rules saved successfully!'
    setTimeout(() => (saveMessage.value = ''), 3000)
  } catch {
    saveMessage.value = 'Failed to save rules'
    setTimeout(() => (saveMessage.value = ''), 4000)
  } finally {
    saving.value = false
  }
}

// Update field names in nodes when schema changes
watch(fieldNames, (names) => {
  for (const node of nodes.value) {
    if (node.data) {
      node.data.fieldNames = names
    }
  }
})
</script>

<template>
  <div v-if="loading" class="text-center py-12 text-muted-foreground">Loading...</div>

  <div v-else class="flex flex-col h-screen">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0"
    >
      <div class="flex items-center gap-3">
        <RouterLink
          :to="`/forms/${formId}/edit`"
          class="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Builder
        </RouterLink>
        <span class="text-border">|</span>
        <h1 class="text-lg font-semibold text-foreground">
          Rules — {{ formName }}
        </h1>
      </div>
      <div class="flex items-center gap-3">
        <span
          v-if="saveMessage"
          class="text-sm"
          :class="saveMessage.includes('success') ? 'text-green-600 dark:text-green-400' : 'text-destructive'"
        >
          {{ saveMessage }}
        </span>
        <Button
          :disabled="saving"
          @click="saveRules"
        >
          {{ saving ? 'Saving...' : 'Save Rules' }}
        </Button>
      </div>
    </div>

    <!-- Body -->
    <div class="flex flex-1 min-h-0">
      <!-- Sidebar: rule list -->
      <div class="w-64 border-r border-border bg-muted flex flex-col shrink-0">
        <div class="p-3 border-b border-border">
          <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Rules ({{ rules.length }})
          </h2>
        </div>

        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          <div
            v-for="(rule, i) in rules"
            :key="rule.id"
            class="group rounded-lg border cursor-pointer transition-all p-3"
            :class="
              i === selectedIndex
                ? 'border-border bg-accent shadow-sm'
                : 'border-transparent hover:border-border hover:bg-background'
            "
            @click="selectRule(i)"
          >
            <div class="flex items-center justify-between mb-1">
              <input
                v-model="rule.name"
                class="text-sm font-medium text-foreground bg-transparent border-none outline-none w-full mr-2"
                :class="{ 'text-muted-foreground line-through': !rule.enabled }"
                @click.stop
              />
              <button
                class="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none shrink-0"
                title="Delete rule"
                @click.stop="deleteRule(i)"
              >
                ×
              </button>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="text-[10px] px-1.5 py-0.5 rounded-full border"
                :class="
                  rule.enabled
                    ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : 'text-muted-foreground bg-muted border-border'
                "
                @click.stop="toggleRule(i)"
              >
                {{ rule.enabled ? 'Enabled' : 'Disabled' }}
              </button>
              <span
                v-if="rule.trigger?.field"
                class="text-[10px] text-muted-foreground truncate"
              >
                on {{ rule.trigger.field }}
              </span>
            </div>
          </div>
        </div>

        <div class="p-2 border-t border-border">
          <Button
            variant="outline"
            class="w-full"
            @click="addRule"
          >
            + New Rule
          </Button>
        </div>
      </div>

      <!-- Canvas area -->
      <div class="flex-1 flex flex-col min-h-0">
        <!-- Toolbar -->
        <div
          v-if="selectedIndex >= 0"
          class="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted"
        >
          <span class="text-xs text-muted-foreground mr-2">Add node:</span>
          <Button variant="outline" size="sm" @click="addConditionGroupNode">
            + Condition Group
          </Button>
          <Button variant="outline" size="sm" @click="addConditionNode">
            + Condition
          </Button>
          <Button variant="outline" size="sm" @click="addActionNode">
            + Action
          </Button>
          <Button variant="outline" size="sm" @click="addBranchNode">
            + Branch
          </Button>
        </div>

        <!-- Vue Flow canvas -->
        <div v-if="selectedIndex >= 0" class="flex-1">
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :node-types="nodeTypes"
            :default-edge-options="{ type: 'smoothstep' }"
            :snap-to-grid="true"
            :snap-grid="[15, 15]"
            fit-view-on-init
            @connect="onConnect"
          >
            <Background />
            <Controls position="bottom-right" />
            <MiniMap position="bottom-left" />
          </VueFlow>
        </div>

        <!-- Empty state -->
        <div
          v-else
          class="flex-1 flex items-center justify-center text-muted-foreground"
        >
          <div class="text-center">
            <svg
              class="w-12 h-12 mx-auto mb-3 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25"
              />
            </svg>
            <p class="text-sm font-medium">
              {{ rules.length === 0 ? 'No rules yet' : 'Select a rule to edit' }}
            </p>
            <p class="text-xs mt-1">
              {{
                rules.length === 0
                  ? 'Click "+ New Rule" to create your first rule'
                  : 'Click a rule in the sidebar to view its flow'
              }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Vue Flow canvas styling */
:deep(.vue-flow) {
  background: hsl(var(--muted));
}
:deep(.vue-flow__edge-path) {
  stroke-width: 2;
}
:deep(.vue-flow__edge-text) {
  font-size: 11px;
  font-weight: 600;
}
:deep(.vue-flow__minimap) {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
}
:deep(.vue-flow__controls) {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
}
</style>
