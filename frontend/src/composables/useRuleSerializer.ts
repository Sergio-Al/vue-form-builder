import type { Node, Edge } from '@vue-flow/core'
import type { Rule, Action, Condition, ConditionGroup } from '@/types/rules'
import { isConditionGroup } from '@/types/rules'
import { buildDependencyGraph } from '@/composables/useRulesEngine'

// ── Flow → Rule ─────────────────────────────────────────────────

export function flowToRule(
  nodes: Node[],
  edges: Edge[],
  ruleId: string,
  ruleName: string,
  enabled: boolean,
): Rule {
  const triggerNode = nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) {
    throw new Error('Rule must have a Trigger node')
  }

  // Find the condition node(s) connected downstream from the trigger
  const conditionNode = findDownstream(triggerNode.id, nodes, edges, [
    'condition',
    'conditionGroup',
  ])

  // Build ConditionGroup from condition node data
  let conditions: ConditionGroup
  if (conditionNode?.type === 'conditionGroup') {
    const d = conditionNode.data as {
      operator: 'and' | 'or'
      conditions: { field: string; op: string; value: any }[]
    }
    conditions = {
      operator: d.operator,
      items: d.conditions
        .filter((c) => c.field)
        .map((c) => ({ field: c.field, op: c.op, value: c.value }) as Condition),
    }
  } else if (conditionNode?.type === 'condition') {
    const d = conditionNode.data as { field: string; op: string; value: any }
    conditions = {
      operator: 'and',
      items: d.field ? [{ field: d.field, op: d.op, value: d.value } as Condition] : [],
    }
  } else {
    conditions = { operator: 'and', items: [] }
  }

  // The node that forks into true/false branches
  const forkNodeId = conditionNode?.id ?? triggerNode.id

  // Collect actions on true path
  const trueTargets = edges
    .filter((e) => e.source === forkNodeId && e.sourceHandle === 'true')
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter((n): n is Node => n?.type === 'action')

  const actions: Action[] = trueTargets.map(nodeToAction)

  // Collect actions on false path
  const falseTargets = edges
    .filter((e) => e.source === forkNodeId && e.sourceHandle === 'false')
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter((n): n is Node => n?.type === 'action')

  const elseActions: Action[] = falseTargets.map(nodeToAction)

  return {
    id: ruleId,
    name: ruleName,
    enabled,
    trigger: {
      field: triggerNode.data.field || '',
      event: 'change',
    },
    conditions,
    actions,
    elseActions,
  }
}

function nodeToAction(n: Node): Action {
  const d = n.data as { actionType: string; target: string; value: any }
  const action: Action = {
    type: d.actionType as Action['type'],
    target: d.target,
  }
  if (d.value !== undefined && d.value !== '') {
    action.value = d.value
  }
  return action
}

function findDownstream(
  sourceId: string,
  nodes: Node[],
  edges: Edge[],
  types: string[],
): Node | undefined {
  const edge = edges.find((e) => e.source === sourceId)
  if (!edge) return undefined
  const target = nodes.find((n) => n.id === edge.target)
  if (!target) return undefined
  if (types.includes(target.type ?? '')) return target
  return undefined
}

// ── Rule → Flow ─────────────────────────────────────────────────

export function ruleToFlow(
  rule: Rule,
  fieldNames: string[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Trigger node
  const triggerId = `trigger-${rule.id}`
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: 50, y: 150 },
    data: { field: rule.trigger.field, event: rule.trigger.event, fieldNames },
  })

  // Condition group node
  const conditionId = `cond-${rule.id}`
  const flatConditions = flattenConditions(rule.conditions)
  nodes.push({
    id: conditionId,
    type: 'conditionGroup',
    position: { x: 330, y: 100 },
    data: {
      operator: rule.conditions.operator,
      conditions:
        flatConditions.length > 0
          ? flatConditions
          : [{ field: '', op: 'eq', value: '' }],
      fieldNames,
    },
  })

  edges.push({
    id: `e-${triggerId}-${conditionId}`,
    source: triggerId,
    sourceHandle: 'output',
    target: conditionId,
    targetHandle: 'input',
    animated: true,
  })

  // True-path action nodes
  rule.actions.forEach((action, i) => {
    const actionId = `action-t-${rule.id}-${i}`
    nodes.push({
      id: actionId,
      type: 'action',
      position: { x: 700, y: 30 + i * 140 },
      data: {
        actionType: action.type,
        target: action.target,
        value: action.value ?? '',
        fieldNames,
      },
    })
    edges.push({
      id: `e-${conditionId}-true-${actionId}`,
      source: conditionId,
      sourceHandle: 'true',
      target: actionId,
      targetHandle: 'input',
      style: { stroke: '#22c55e' },
      label: i === 0 ? 'True' : undefined,
    })
  })

  // False-path action nodes (else actions)
  const yOffset = Math.max(rule.actions.length * 140, 140) + 60
  rule.elseActions.forEach((action, i) => {
    const actionId = `action-f-${rule.id}-${i}`
    nodes.push({
      id: actionId,
      type: 'action',
      position: { x: 700, y: yOffset + i * 140 },
      data: {
        actionType: action.type,
        target: action.target,
        value: action.value ?? '',
        fieldNames,
      },
    })
    edges.push({
      id: `e-${conditionId}-false-${actionId}`,
      source: conditionId,
      sourceHandle: 'false',
      target: actionId,
      targetHandle: 'input',
      style: { stroke: '#ef4444' },
      label: i === 0 ? 'False' : undefined,
    })
  })

  return { nodes, edges }
}

function flattenConditions(
  group: ConditionGroup,
): { field: string; op: string; value: any }[] {
  const result: { field: string; op: string; value: any }[] = []
  for (const item of group.items) {
    if (isConditionGroup(item)) {
      result.push(...flattenConditions(item))
    } else {
      result.push({ field: item.field, op: item.op, value: item.value })
    }
  }
  return result
}

// ── Default flow for a new rule ─────────────────────────────────

export function createDefaultFlow(
  ruleId: string,
  fieldNames: string[],
): { nodes: Node[]; edges: Edge[] } {
  const triggerId = `trigger-${ruleId}`
  const conditionId = `cond-${ruleId}`
  const actionId = `action-t-${ruleId}-0`

  const nodes: Node[] = [
    {
      id: triggerId,
      type: 'trigger',
      position: { x: 50, y: 150 },
      data: { field: '', event: 'change', fieldNames },
    },
    {
      id: conditionId,
      type: 'conditionGroup',
      position: { x: 330, y: 100 },
      data: {
        operator: 'and',
        conditions: [{ field: '', op: 'eq', value: '' }],
        fieldNames,
      },
    },
    {
      id: actionId,
      type: 'action',
      position: { x: 700, y: 130 },
      data: { actionType: '', target: '', value: '', fieldNames },
    },
  ]

  const edges: Edge[] = [
    {
      id: `e-${triggerId}-${conditionId}`,
      source: triggerId,
      sourceHandle: 'output',
      target: conditionId,
      targetHandle: 'input',
      animated: true,
    },
    {
      id: `e-${conditionId}-true-${actionId}`,
      source: conditionId,
      sourceHandle: 'true',
      target: actionId,
      targetHandle: 'input',
      style: { stroke: '#22c55e' },
      label: 'True',
    },
  ]

  return { nodes, edges }
}

// ── Validation ──────────────────────────────────────────────────

export interface FlowValidationError {
  message: string
  nodeId?: string
}

export function validateFlow(
  nodes: Node[],
  edges: Edge[],
): FlowValidationError[] {
  const errors: FlowValidationError[] = []

  // Must have exactly one trigger
  const triggers = nodes.filter((n) => n.type === 'trigger')
  if (triggers.length === 0) {
    errors.push({ message: 'Rule must have a Trigger node' })
  } else if (triggers.length > 1) {
    errors.push({ message: 'Rule must have only one Trigger node' })
  } else if (!triggers[0].data.field) {
    errors.push({ message: 'Trigger must have a field selected', nodeId: triggers[0].id })
  }

  // All condition nodes/groups must have fields filled
  for (const node of nodes) {
    if (node.type === 'condition') {
      if (!node.data.field || !node.data.op) {
        errors.push({ message: 'Condition is incomplete', nodeId: node.id })
      }
    }
    if (node.type === 'conditionGroup') {
      const conds = node.data.conditions as { field: string; op: string }[]
      const filled = conds.filter((c) => c.field && c.op)
      if (filled.length === 0) {
        errors.push({ message: 'Condition group has no valid conditions', nodeId: node.id })
      }
    }
  }

  // All action nodes must have type + target
  for (const node of nodes) {
    if (node.type === 'action') {
      if (!node.data.actionType) {
        errors.push({ message: 'Action has no type selected', nodeId: node.id })
      }
      if (!node.data.target) {
        errors.push({ message: 'Action has no target field selected', nodeId: node.id })
      }
    }
  }

  return errors
}

// ── Cross-rule cycle detection ──────────────────────────────────

export function validateNoCycles(rules: Rule[]): string[] {
  const { sortedRules } = buildDependencyGraph(rules)
  const enabledRules = rules.filter((r) => r.enabled)
  if (sortedRules.length < enabledRules.length) {
    const sortedIds = new Set(sortedRules.map((r) => r.id))
    const cyclic = enabledRules.filter((r) => !sortedIds.has(r.id))
    return cyclic.map((r) => `Rule "${r.name}" is part of a cyclic dependency`)
  }
  return []
}

// ── Restore flow meta ───────────────────────────────────────────

export function restoreFlowMeta(
  nodes: Node[],
  fieldNames: string[],
): Node[] {
  return nodes.map((n) => ({
    ...n,
    data: { ...n.data, fieldNames },
  }))
}
