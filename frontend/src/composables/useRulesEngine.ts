import { reactive } from 'vue'
import type { Rule, Condition, ConditionGroup, Action } from '@/types/rules'
import { isConditionGroup } from '@/types/rules'

// ── Vueform-native condition mapping (Phase 3) ─────────────────

const OP_TO_VUEFORM: Partial<Record<Condition['op'], string>> = {
  eq: '==',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: '*',
  is_empty: 'empty',
  is_not_empty: 'not_empty',
  in: 'in',
  not_in: 'not_in',
}

/**
 * A flat AND group is one whose top-level operator is 'and' and every
 * item is a plain Condition (no nested ConditionGroups).
 */
function isFlatAnd(
  group: ConditionGroup,
): group is ConditionGroup & { items: Condition[] } {
  return (
    group.operator === 'and' &&
    group.items.every((item) => !isConditionGroup(item))
  )
}

function allOperatorsMappable(conditions: Condition[]): boolean {
  return conditions.every((c) => OP_TO_VUEFORM[c.op] != null)
}

function conditionToVueform(condition: Condition): any[] {
  const vfOp = OP_TO_VUEFORM[condition.op]!
  if (condition.op === 'is_empty' || condition.op === 'is_not_empty') {
    return [condition.field, vfOp]
  }
  return [condition.field, vfOp, condition.value]
}

/**
 * Returns true when a rule can be fully expressed as Vueform-native
 * `conditions` arrays (simple show/hide with flat AND conditions).
 */
function isNativeEligible(rule: Rule): boolean {
  if (!rule.enabled) return false
  if (rule.actions.length === 0) return false
  if (!rule.actions.every((a) => a.type === 'show')) return false
  if (
    rule.elseActions.length > 0 &&
    !rule.elseActions.every((a) => a.type === 'hide')
  )
    return false

  // Ensure hide targets are a subset of show targets so nothing is lost
  const showTargets = new Set(rule.actions.map((a) => a.target))
  if (
    rule.elseActions.some(
      (a) => a.type === 'hide' && !showTargets.has(a.target),
    )
  )
    return false

  if (!isFlatAnd(rule.conditions)) return false
  if (!allOperatorsMappable(rule.conditions.items)) return false

  return true
}

/**
 * Injects Vueform-native `conditions` into the schema for eligible
 * show/hide rules.  Returns the enriched schema and the set of rule
 * IDs handled natively so the imperative engine can skip them.
 */
export function injectConditionsIntoSchema(
  schema: Record<string, any>,
  rules: Rule[],
): { schema: Record<string, any>; nativeRuleIds: Set<string> } {
  const result: Record<string, any> = {}
  for (const [key, field] of Object.entries(schema)) {
    result[key] = { ...field }
  }

  const nativeRuleIds = new Set<string>()

  for (const rule of rules) {
    if (!isNativeEligible(rule)) continue

    const conditions = (rule.conditions.items as Condition[]).map(
      conditionToVueform,
    )

    for (const action of rule.actions) {
      if (result[action.target]) {
        const existing: any[] = result[action.target].conditions ?? []
        result[action.target] = {
          ...result[action.target],
          conditions: [...existing, ...conditions],
        }
      }
    }

    nativeRuleIds.add(rule.id)
  }

  return { schema: result, nativeRuleIds }
}

// ── Condition evaluation ────────────────────────────────────────

export function evaluateCondition(
  condition: Condition,
  data: Record<string, any>,
): boolean {
  const fieldValue = data[condition.field]

  switch (condition.op) {
    case 'eq':
      return fieldValue == condition.value
    case 'neq':
      return fieldValue != condition.value
    case 'gt':
      return Number(fieldValue) > Number(condition.value)
    case 'gte':
      return Number(fieldValue) >= Number(condition.value)
    case 'lt':
      return Number(fieldValue) < Number(condition.value)
    case 'lte':
      return Number(fieldValue) <= Number(condition.value)
    case 'contains':
      return String(fieldValue ?? '').includes(String(condition.value))
    case 'not_contains':
      return !String(fieldValue ?? '').includes(String(condition.value))
    case 'is_empty':
      return fieldValue == null || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)
    case 'is_not_empty':
      return fieldValue != null && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0)
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue)
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue)
    default:
      return false
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup,
  data: Record<string, any>,
): boolean {
  if (group.items.length === 0) return true

  if (group.operator === 'and') {
    return group.items.every((item) =>
      isConditionGroup(item)
        ? evaluateConditionGroup(item, data)
        : evaluateCondition(item, data),
    )
  }
  // 'or'
  return group.items.some((item) =>
    isConditionGroup(item)
      ? evaluateConditionGroup(item, data)
      : evaluateCondition(item, data),
  )
}

// ── Dependency graph & cycle detection ──────────────────────────

interface DepGraph {
  /** trigger field → rules that fire */
  triggerMap: Map<string, Rule[]>
  /** ordered list of rules after topological sort (cycles removed) */
  sortedRules: Rule[]
}

/**
 * Build a dependency graph from rules and return a topologically sorted
 * list.  Rules that participate in a cycle are excluded and logged.
 */
export function buildDependencyGraph(rules: Rule[]): DepGraph {
  const enabledRules = rules.filter((r) => r.enabled)

  // triggerMap: field → rules triggered by that field
  const triggerMap = new Map<string, Rule[]>()
  for (const rule of enabledRules) {
    const field = rule.trigger.field
    if (!triggerMap.has(field)) triggerMap.set(field, [])
    triggerMap.get(field)!.push(rule)
  }

  // For topological sort, build adjacency: ruleId → dependent ruleIds
  // A rule R1 "depends on" R2 if R2's actions set a field that R1 triggers on
  const ruleById = new Map<string, Rule>(enabledRules.map((r) => [r.id, r]))

  // field → rules that target it (via actions)
  const producerOf = new Map<string, Set<string>>() // field → ruleIds that write it
  for (const rule of enabledRules) {
    const allActions = [...rule.actions, ...rule.elseActions]
    for (const action of allActions) {
      if (!producerOf.has(action.target)) producerOf.set(action.target, new Set())
      producerOf.get(action.target)!.add(rule.id)
    }
  }

  // adjacency: ruleId → set of ruleIds that must run before it
  const adj = new Map<string, Set<string>>()
  for (const rule of enabledRules) adj.set(rule.id, new Set())

  for (const rule of enabledRules) {
    const triggerField = rule.trigger.field
    const producers = producerOf.get(triggerField)
    if (producers) {
      for (const pid of producers) {
        if (pid !== rule.id) {
          // pid must run before rule
          adj.get(rule.id)!.add(pid)
        }
      }
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>()
  for (const rule of enabledRules) inDegree.set(rule.id, 0)
  for (const [, deps] of adj) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1)
    }
  }

  // Wait — Kahn's works on outgoing edges. Let me re-orient:
  // adj currently is: ruleId → set of ruleIds that must run BEFORE it ("depends on")
  // For Kahn's, we need: forward edges = "must run before" direction
  // forwardAdj: ruleId → set of ruleIds that depend on it
  const forwardAdj = new Map<string, Set<string>>()
  for (const rule of enabledRules) forwardAdj.set(rule.id, new Set())

  const inDeg = new Map<string, number>()
  for (const rule of enabledRules) inDeg.set(rule.id, 0)

  for (const [ruleId, deps] of adj) {
    for (const depId of deps) {
      forwardAdj.get(depId)!.add(ruleId)
      inDeg.set(ruleId, (inDeg.get(ruleId) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id)
  }

  const sorted: Rule[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(ruleById.get(id)!)
    for (const next of forwardAdj.get(id) ?? []) {
      const d = inDeg.get(next)! - 1
      inDeg.set(next, d)
      if (d === 0) queue.push(next)
    }
  }

  if (sorted.length < enabledRules.length) {
    const sortedIds = new Set(sorted.map((r) => r.id))
    const cyclic = enabledRules.filter((r) => !sortedIds.has(r.id))
    console.warn(
      '[RulesEngine] Cyclic dependencies detected — skipping rules:',
      cyclic.map((r) => r.name),
    )
  }

  return { triggerMap, sortedRules: sorted }
}

// ── Action execution ────────────────────────────────────────────

function executeActions(
  actions: Action[],
  formData: Record<string, any>,
  visibilityMap: Record<string, boolean>,
  requiredMap: Record<string, boolean>,
  disabledMap: Record<string, boolean>,
  optionsMap: Record<string, any[]>,
) {
  for (const action of actions) {
    switch (action.type) {
      case 'set_value':
        formData[action.target] = action.value
        break
      case 'clear_value':
        formData[action.target] = null
        break
      case 'show':
        visibilityMap[action.target] = true
        break
      case 'hide':
        visibilityMap[action.target] = false
        break
      case 'set_required':
        requiredMap[action.target] = true
        break
      case 'remove_required':
        requiredMap[action.target] = false
        break
      case 'set_options':
        optionsMap[action.target] = action.value
        break
      case 'disable':
        disabledMap[action.target] = true
        break
      case 'enable':
        disabledMap[action.target] = false
        break
    }
  }
}

// ── Main composable ─────────────────────────────────────────────

export function useRulesEngine(rules: Rule[], formData: Record<string, any>) {
  const visibilityMap = reactive<Record<string, boolean>>({})
  const requiredMap = reactive<Record<string, boolean>>({})
  const disabledMap = reactive<Record<string, boolean>>({})
  const optionsMap = reactive<Record<string, any[]>>({})

  const { triggerMap, sortedRules } = buildDependencyGraph(rules)

  // Track re-entrant calls to avoid infinite loops at runtime
  const evaluating = new Set<string>()

  /**
   * Called when a field value changes.  Evaluates all rules triggered
   * by the field and cascades through the dependency graph.
   */
  function onFieldChange(fieldName: string, value: any) {
    formData[fieldName] = value
    processTriggeredRules(fieldName)
  }

  function processTriggeredRules(fieldName: string) {
    const triggered = triggerMap.get(fieldName)
    if (!triggered) return

    // Evaluate only rules in topological order that are triggered by this field
    const relevantIds = new Set(triggered.map((r) => r.id))
    const orderedRelevant = sortedRules.filter((r) => relevantIds.has(r.id))

    for (const rule of orderedRelevant) {
      if (evaluating.has(rule.id)) continue
      evaluating.add(rule.id)

      const conditionsMet = evaluateConditionGroup(rule.conditions, formData)
      const actionsToRun = conditionsMet ? rule.actions : rule.elseActions

      // Collect target fields before executing so we can cascade
      const targetFields = actionsToRun.map((a) => a.target)

      executeActions(actionsToRun, formData, visibilityMap, requiredMap, disabledMap, optionsMap)

      evaluating.delete(rule.id)

      // Cascade: if an action changed a field that triggers other rules
      for (const target of targetFields) {
        if (triggerMap.has(target)) {
          processTriggeredRules(target)
        }
      }
    }
  }

  /**
   * Run all rules once to initialise maps based on current form data.
   */
  function initialEvaluation() {
    for (const rule of sortedRules) {
      const conditionsMet = evaluateConditionGroup(rule.conditions, formData)
      const actionsToRun = conditionsMet ? rule.actions : rule.elseActions
      executeActions(actionsToRun, formData, visibilityMap, requiredMap, disabledMap, optionsMap)
    }
  }

  initialEvaluation()

  return {
    visibilityMap,
    requiredMap,
    disabledMap,
    optionsMap,
    onFieldChange,
  }
}
