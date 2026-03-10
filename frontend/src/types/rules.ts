export interface Rule {
  id: string
  name: string
  enabled: boolean
  trigger: {
    field: string
    event: 'change'
  }
  conditions: ConditionGroup
  actions: Action[]
  elseActions: Action[]
}

export interface ConditionGroup {
  operator: 'and' | 'or'
  items: (Condition | ConditionGroup)[]
}

export interface Condition {
  field: string
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
    | 'not_in'
  value?: any
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
    | 'enable'
  target: string
  value?: any
}

export interface RuleFlowMeta {
  ruleId: string
  nodes: any[]
  edges: any[]
}

export function isConditionGroup(item: Condition | ConditionGroup): item is ConditionGroup {
  return 'operator' in item && 'items' in item
}
