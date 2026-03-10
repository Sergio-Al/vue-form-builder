/**
 * Server-side condition evaluator — mirrors the frontend
 * useRulesEngine condition logic with zero Vue dependencies.
 */

// ── Type definitions (mirrored from frontend/src/types/rules.ts) ──

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { field: string; event: 'change' };
  conditions: ConditionGroup;
  actions: Action[];
  elseActions: Action[];
}

export interface ConditionGroup {
  operator: 'and' | 'or';
  items: (Condition | ConditionGroup)[];
}

export interface Condition {
  field: string;
  op:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'not_contains'
    | 'is_empty'
    | 'is_not_empty'
    | 'in'
    | 'not_in';
  value?: any;
}

export interface Action {
  type:
    | 'set_value'
    | 'clear_value'
    | 'show'
    | 'hide'
    | 'set_required'
    | 'remove_required'
    | 'set_options'
    | 'disable'
    | 'enable';
  target: string;
  value?: any;
}

function isConditionGroup(
  item: Condition | ConditionGroup,
): item is ConditionGroup {
  return 'operator' in item && 'items' in item;
}

// ── Condition evaluation ──────────────────────────────────────────

export function evaluateCondition(
  condition: Condition,
  data: Record<string, any>,
): boolean {
  const fieldValue = data[condition.field];

  switch (condition.op) {
    case 'eq':
      return fieldValue == condition.value;
    case 'neq':
      return fieldValue != condition.value;
    case 'gt':
      return Number(fieldValue) > Number(condition.value);
    case 'gte':
      return Number(fieldValue) >= Number(condition.value);
    case 'lt':
      return Number(fieldValue) < Number(condition.value);
    case 'lte':
      return Number(fieldValue) <= Number(condition.value);
    case 'contains':
      return String(fieldValue ?? '').includes(String(condition.value));
    case 'not_contains':
      return !String(fieldValue ?? '').includes(String(condition.value));
    case 'is_empty':
      return (
        fieldValue == null ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case 'is_not_empty':
      return (
        fieldValue != null &&
        fieldValue !== '' &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'not_in':
      return (
        Array.isArray(condition.value) && !condition.value.includes(fieldValue)
      );
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup,
  data: Record<string, any>,
): boolean {
  if (group.items.length === 0) return true;

  if (group.operator === 'and') {
    return group.items.every((item) =>
      isConditionGroup(item)
        ? evaluateConditionGroup(item, data)
        : evaluateCondition(item, data),
    );
  }
  // 'or'
  return group.items.some((item) =>
    isConditionGroup(item)
      ? evaluateConditionGroup(item, data)
      : evaluateCondition(item, data),
  );
}

// ── Rule-based maps ───────────────────────────────────────────────

/**
 * Evaluate all enabled rules against submitted data and return maps
 * indicating which fields are conditionally required and which are hidden.
 */
export function evaluateRules(
  rules: Rule[],
  data: Record<string, any>,
): { requiredMap: Record<string, boolean>; hiddenFields: Set<string> } {
  const requiredMap: Record<string, boolean> = {};
  const hiddenFields = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const conditionsMet = evaluateConditionGroup(rule.conditions, data);
    const actionsToRun = conditionsMet ? rule.actions : rule.elseActions;

    for (const action of actionsToRun) {
      switch (action.type) {
        case 'set_required':
          requiredMap[action.target] = true;
          break;
        case 'remove_required':
          requiredMap[action.target] = false;
          break;
        case 'hide':
          hiddenFields.add(action.target);
          break;
        case 'show':
          hiddenFields.delete(action.target);
          break;
      }
    }
  }

  return { requiredMap, hiddenFields };
}
