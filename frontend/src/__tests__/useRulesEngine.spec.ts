import { describe, it, expect, vi } from 'vitest'
import {
  evaluateCondition,
  evaluateConditionGroup,
  buildDependencyGraph,
  useRulesEngine,
  injectConditionsIntoSchema,
} from '@/composables/useRulesEngine'
import type { Condition, ConditionGroup, Rule } from '@/types/rules'

// ── helpers ──

function makeRule(overrides: Partial<Rule> & Pick<Rule, 'id'>): Rule {
  return {
    name: overrides.id,
    enabled: true,
    trigger: { field: 'a', event: 'change' },
    conditions: { operator: 'and', items: [] },
    actions: [],
    elseActions: [],
    ...overrides,
  }
}

// ──────────────────────────────────────────────────────────────────
// evaluateCondition
// ──────────────────────────────────────────────────────────────────

describe('evaluateCondition', () => {
  it('eq — matches loosely', () => {
    expect(evaluateCondition({ field: 'x', op: 'eq', value: 'US' }, { x: 'US' })).toBe(true)
    expect(evaluateCondition({ field: 'x', op: 'eq', value: 1 }, { x: '1' })).toBe(true)
    expect(evaluateCondition({ field: 'x', op: 'eq', value: 'CA' }, { x: 'US' })).toBe(false)
  })

  it('neq', () => {
    expect(evaluateCondition({ field: 'x', op: 'neq', value: 'US' }, { x: 'CA' })).toBe(true)
    expect(evaluateCondition({ field: 'x', op: 'neq', value: 'US' }, { x: 'US' })).toBe(false)
  })

  it('gt / gte / lt / lte', () => {
    expect(evaluateCondition({ field: 'age', op: 'gt', value: 18 }, { age: 20 })).toBe(true)
    expect(evaluateCondition({ field: 'age', op: 'gt', value: 18 }, { age: 18 })).toBe(false)
    expect(evaluateCondition({ field: 'age', op: 'gte', value: 18 }, { age: 18 })).toBe(true)
    expect(evaluateCondition({ field: 'age', op: 'lt', value: 18 }, { age: 10 })).toBe(true)
    expect(evaluateCondition({ field: 'age', op: 'lte', value: 18 }, { age: 18 })).toBe(true)
  })

  it('contains / not_contains', () => {
    expect(evaluateCondition({ field: 'name', op: 'contains', value: 'ohn' }, { name: 'John' })).toBe(true)
    expect(evaluateCondition({ field: 'name', op: 'not_contains', value: 'xyz' }, { name: 'John' })).toBe(true)
  })

  it('is_empty / is_not_empty', () => {
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: '' })).toBe(true)
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: null })).toBe(true)
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: undefined })).toBe(true)
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: [] })).toBe(true)
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: 'a' })).toBe(false)
    expect(evaluateCondition({ field: 'x', op: 'is_not_empty' }, { x: 'a' })).toBe(true)
  })

  it('in / not_in', () => {
    expect(evaluateCondition({ field: 'x', op: 'in', value: ['a', 'b'] }, { x: 'a' })).toBe(true)
    expect(evaluateCondition({ field: 'x', op: 'in', value: ['a', 'b'] }, { x: 'c' })).toBe(false)
    expect(evaluateCondition({ field: 'x', op: 'not_in', value: ['a', 'b'] }, { x: 'c' })).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────
// evaluateConditionGroup
// ──────────────────────────────────────────────────────────────────

describe('evaluateConditionGroup', () => {
  it('empty group → true', () => {
    expect(evaluateConditionGroup({ operator: 'and', items: [] }, {})).toBe(true)
  })

  it('AND — all must pass', () => {
    const group: ConditionGroup = {
      operator: 'and',
      items: [
        { field: 'a', op: 'eq', value: 1 },
        { field: 'b', op: 'eq', value: 2 },
      ],
    }
    expect(evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(true)
    expect(evaluateConditionGroup(group, { a: 1, b: 3 })).toBe(false)
  })

  it('OR — any can pass', () => {
    const group: ConditionGroup = {
      operator: 'or',
      items: [
        { field: 'a', op: 'eq', value: 1 },
        { field: 'b', op: 'eq', value: 2 },
      ],
    }
    expect(evaluateConditionGroup(group, { a: 1, b: 99 })).toBe(true)
    expect(evaluateConditionGroup(group, { a: 99, b: 2 })).toBe(true)
    expect(evaluateConditionGroup(group, { a: 99, b: 99 })).toBe(false)
  })

  it('nested groups', () => {
    const group: ConditionGroup = {
      operator: 'and',
      items: [
        { field: 'a', op: 'eq', value: 1 },
        {
          operator: 'or',
          items: [
            { field: 'b', op: 'eq', value: 2 },
            { field: 'c', op: 'eq', value: 3 },
          ],
        },
      ],
    }
    expect(evaluateConditionGroup(group, { a: 1, b: 2, c: 0 })).toBe(true)
    expect(evaluateConditionGroup(group, { a: 1, b: 0, c: 3 })).toBe(true)
    expect(evaluateConditionGroup(group, { a: 1, b: 0, c: 0 })).toBe(false)
    expect(evaluateConditionGroup(group, { a: 0, b: 2, c: 3 })).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────
// buildDependencyGraph — cycle detection
// ──────────────────────────────────────────────────────────────────

describe('buildDependencyGraph', () => {
  it('returns all rules when there are no cycles', () => {
    const rules: Rule[] = [
      makeRule({ id: 'r1', trigger: { field: 'country', event: 'change' }, actions: [{ type: 'set_value', target: 'currency', value: 'USD' }] }),
      makeRule({ id: 'r2', trigger: { field: 'currency', event: 'change' }, actions: [{ type: 'set_value', target: 'symbol', value: '$' }] }),
    ]
    const { sortedRules } = buildDependencyGraph(rules)
    expect(sortedRules).toHaveLength(2)
    // r1 must come before r2 (r1 produces currency, r2 triggers on currency)
    const idx1 = sortedRules.findIndex((r) => r.id === 'r1')
    const idx2 = sortedRules.findIndex((r) => r.id === 'r2')
    expect(idx1).toBeLessThan(idx2)
  })

  it('detects and removes cyclic rules', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const rules: Rule[] = [
      makeRule({ id: 'r1', trigger: { field: 'a', event: 'change' }, actions: [{ type: 'set_value', target: 'b', value: 1 }] }),
      makeRule({ id: 'r2', trigger: { field: 'b', event: 'change' }, actions: [{ type: 'set_value', target: 'a', value: 2 }] }),
    ]
    const { sortedRules } = buildDependencyGraph(rules)
    // Both are cyclic → both should be removed
    expect(sortedRules).toHaveLength(0)
    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
  })

  it('skips disabled rules', () => {
    const rules: Rule[] = [
      makeRule({ id: 'r1', enabled: false, trigger: { field: 'a', event: 'change' }, actions: [{ type: 'show', target: 'b' }] }),
      makeRule({ id: 'r2', trigger: { field: 'a', event: 'change' }, actions: [{ type: 'show', target: 'c' }] }),
    ]
    const { sortedRules } = buildDependencyGraph(rules)
    expect(sortedRules).toHaveLength(1)
    expect(sortedRules[0].id).toBe('r2')
  })
})

// ──────────────────────────────────────────────────────────────────
// useRulesEngine — action execution
// ──────────────────────────────────────────────────────────────────

describe('useRulesEngine', () => {
  it('set_value action populates formData', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'country', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'country', op: 'eq', value: 'US' }] },
        actions: [{ type: 'set_value', target: 'currency', value: 'USD' }],
        elseActions: [{ type: 'clear_value', target: 'currency' }],
      }),
    ]
    const formData: Record<string, any> = {}

    const { onFieldChange } = useRulesEngine(rules, formData)

    onFieldChange('country', 'US')
    expect(formData.currency).toBe('USD')

    onFieldChange('country', 'MX')
    expect(formData.currency).toBeNull()
  })

  it('show/hide actions update visibilityMap', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'has_discount', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'has_discount', op: 'eq', value: true }] },
        actions: [{ type: 'show', target: 'discount_code' }],
        elseActions: [{ type: 'hide', target: 'discount_code' }],
      }),
    ]
    const formData: Record<string, any> = {}

    const { visibilityMap, onFieldChange } = useRulesEngine(rules, formData)

    onFieldChange('has_discount', true)
    expect(visibilityMap.discount_code).toBe(true)

    onFieldChange('has_discount', false)
    expect(visibilityMap.discount_code).toBe(false)
  })

  it('set_required / remove_required actions update requiredMap', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'age', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'age', op: 'lt', value: 18 }] },
        actions: [{ type: 'set_required', target: 'guardian_name' }],
        elseActions: [{ type: 'remove_required', target: 'guardian_name' }],
      }),
    ]
    const formData: Record<string, any> = {}

    const { requiredMap, onFieldChange } = useRulesEngine(rules, formData)

    onFieldChange('age', 10)
    expect(requiredMap.guardian_name).toBe(true)

    onFieldChange('age', 25)
    expect(requiredMap.guardian_name).toBe(false)
  })

  it('disable / enable actions update disabledMap', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'status', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'status', op: 'eq', value: 'locked' }] },
        actions: [{ type: 'disable', target: 'name' }],
        elseActions: [{ type: 'enable', target: 'name' }],
      }),
    ]
    const formData: Record<string, any> = {}

    const { disabledMap, onFieldChange } = useRulesEngine(rules, formData)

    onFieldChange('status', 'locked')
    expect(disabledMap.name).toBe(true)

    onFieldChange('status', 'active')
    expect(disabledMap.name).toBe(false)
  })

  it('set_options action updates optionsMap', () => {
    const usStates = [{ value: 'CA', label: 'California' }]
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'country', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'country', op: 'eq', value: 'US' }] },
        actions: [{ type: 'set_options', target: 'state', value: usStates }],
        elseActions: [{ type: 'clear_value', target: 'state' }],
      }),
    ]
    const formData: Record<string, any> = {}

    const { optionsMap, onFieldChange } = useRulesEngine(rules, formData)

    onFieldChange('country', 'US')
    expect(optionsMap.state).toEqual(usStates)
  })

  it('cascading rules: A → sets B → triggers rule on B → sets C', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'country', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'country', op: 'eq', value: 'US' }] },
        actions: [{ type: 'set_value', target: 'currency', value: 'USD' }],
      }),
      makeRule({
        id: 'r2',
        trigger: { field: 'currency', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'currency', op: 'eq', value: 'USD' }] },
        actions: [{ type: 'set_value', target: 'symbol', value: '$' }],
      }),
    ]
    const formData: Record<string, any> = {}

    const { onFieldChange } = useRulesEngine(rules, formData)

    onFieldChange('country', 'US')
    expect(formData.currency).toBe('USD')
    expect(formData.symbol).toBe('$')
  })

  it('initial evaluation runs on construction', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'plan', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        actions: [{ type: 'show', target: 'billing_info' }],
        elseActions: [{ type: 'hide', target: 'billing_info' }],
      }),
    ]
    // plan is not 'pro' initially, so elseActions should fire
    const formData: Record<string, any> = { plan: 'free' }

    const { visibilityMap } = useRulesEngine(rules, formData)
    expect(visibilityMap.billing_info).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────
// injectConditionsIntoSchema (Phase 3)
// ──────────────────────────────────────────────────────────────────

describe('injectConditionsIntoSchema', () => {
  const baseSchema: Record<string, any> = {
    has_discount: { type: 'toggle', label: 'Has discount?' },
    discount_code: { type: 'text', label: 'Discount Code' },
    country: { type: 'select', label: 'Country' },
    state: { type: 'select', label: 'State' },
    notes: { type: 'textarea', label: 'Notes' },
  }

  it('injects Vueform conditions for a simple show rule (flat AND, eq)', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'has_discount', event: 'change' },
        conditions: {
          operator: 'and',
          items: [{ field: 'has_discount', op: 'eq', value: true }],
        },
        actions: [{ type: 'show', target: 'discount_code' }],
        elseActions: [{ type: 'hide', target: 'discount_code' }],
      }),
    ]

    const { schema, nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)

    expect(nativeRuleIds.has('r1')).toBe(true)
    expect(schema.discount_code.conditions).toEqual([
      ['has_discount', '==', true],
    ])
    // Other fields remain untouched
    expect(schema.has_discount.conditions).toBeUndefined()
  })

  it('injects multiple conditions (flat AND with several items)', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'country', event: 'change' },
        conditions: {
          operator: 'and',
          items: [
            { field: 'country', op: 'eq', value: 'US' },
            { field: 'has_discount', op: 'eq', value: true },
          ],
        },
        actions: [{ type: 'show', target: 'state' }],
      }),
    ]

    const { schema, nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)

    expect(nativeRuleIds.has('r1')).toBe(true)
    expect(schema.state.conditions).toEqual([
      ['country', '==', 'US'],
      ['has_discount', '==', true],
    ])
  })

  it('maps all supported operators correctly', () => {
    const ops: Array<{ op: any; vfOp: string; hasValue: boolean }> = [
      { op: 'eq', vfOp: '==', hasValue: true },
      { op: 'neq', vfOp: '!=', hasValue: true },
      { op: 'gt', vfOp: '>', hasValue: true },
      { op: 'gte', vfOp: '>=', hasValue: true },
      { op: 'lt', vfOp: '<', hasValue: true },
      { op: 'lte', vfOp: '<=', hasValue: true },
      { op: 'contains', vfOp: '*', hasValue: true },
      { op: 'in', vfOp: 'in', hasValue: true },
      { op: 'not_in', vfOp: 'not_in', hasValue: true },
      { op: 'is_empty', vfOp: 'empty', hasValue: false },
      { op: 'is_not_empty', vfOp: 'not_empty', hasValue: false },
    ]

    for (const { op, vfOp, hasValue } of ops) {
      const rules: Rule[] = [
        makeRule({
          id: `r_${op}`,
          trigger: { field: 'country', event: 'change' },
          conditions: {
            operator: 'and',
            items: [{ field: 'country', op, value: hasValue ? 'test' : undefined }],
          },
          actions: [{ type: 'show', target: 'state' }],
        }),
      ]

      const { schema } = injectConditionsIntoSchema(baseSchema, rules)
      const expected = hasValue ? ['country', vfOp, 'test'] : ['country', vfOp]
      expect(schema.state.conditions).toEqual([expected])
    }
  })

  it('falls back (not native) for rules with non-show actions', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'country', event: 'change' },
        conditions: {
          operator: 'and',
          items: [{ field: 'country', op: 'eq', value: 'US' }],
        },
        actions: [
          { type: 'show', target: 'state' },
          { type: 'set_value', target: 'currency', value: 'USD' },
        ],
      }),
    ]

    const { nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)
    expect(nativeRuleIds.size).toBe(0)
  })

  it('falls back for nested OR conditions', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'country', event: 'change' },
        conditions: {
          operator: 'or',
          items: [
            { field: 'country', op: 'eq', value: 'US' },
            { field: 'country', op: 'eq', value: 'CA' },
          ],
        },
        actions: [{ type: 'show', target: 'state' }],
      }),
    ]

    const { nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)
    expect(nativeRuleIds.size).toBe(0)
  })

  it('falls back for nested condition groups', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'country', event: 'change' },
        conditions: {
          operator: 'and',
          items: [
            { field: 'country', op: 'eq', value: 'US' },
            {
              operator: 'or',
              items: [
                { field: 'has_discount', op: 'eq', value: true },
                { field: 'notes', op: 'is_not_empty' },
              ],
            },
          ],
        },
        actions: [{ type: 'show', target: 'state' }],
      }),
    ]

    const { nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)
    expect(nativeRuleIds.size).toBe(0)
  })

  it('falls back for not_contains operator (no Vueform equivalent)', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'country', event: 'change' },
        conditions: {
          operator: 'and',
          items: [{ field: 'country', op: 'not_contains', value: 'test' }],
        },
        actions: [{ type: 'show', target: 'state' }],
      }),
    ]

    const { nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)
    expect(nativeRuleIds.size).toBe(0)
  })

  it('falls back when elseActions target fields not in show actions', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'has_discount', event: 'change' },
        conditions: {
          operator: 'and',
          items: [{ field: 'has_discount', op: 'eq', value: true }],
        },
        actions: [{ type: 'show', target: 'discount_code' }],
        elseActions: [{ type: 'hide', target: 'notes' }],
      }),
    ]

    const { nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)
    expect(nativeRuleIds.size).toBe(0)
  })

  it('skips disabled rules', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        enabled: false,
        trigger: { field: 'has_discount', event: 'change' },
        conditions: {
          operator: 'and',
          items: [{ field: 'has_discount', op: 'eq', value: true }],
        },
        actions: [{ type: 'show', target: 'discount_code' }],
      }),
    ]

    const { nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)
    expect(nativeRuleIds.size).toBe(0)
  })

  it('merges with existing conditions on the field', () => {
    const schemaWithConditions = {
      ...baseSchema,
      discount_code: {
        ...baseSchema.discount_code,
        conditions: [['some_field', '==', 'existing']],
      },
    }

    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'has_discount', event: 'change' },
        conditions: {
          operator: 'and',
          items: [{ field: 'has_discount', op: 'eq', value: true }],
        },
        actions: [{ type: 'show', target: 'discount_code' }],
      }),
    ]

    const { schema } = injectConditionsIntoSchema(schemaWithConditions, rules)
    expect(schema.discount_code.conditions).toEqual([
      ['some_field', '==', 'existing'],
      ['has_discount', '==', true],
    ])
  })

  it('handles multiple show targets in one rule', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'has_discount', event: 'change' },
        conditions: {
          operator: 'and',
          items: [{ field: 'has_discount', op: 'eq', value: true }],
        },
        actions: [
          { type: 'show', target: 'discount_code' },
          { type: 'show', target: 'notes' },
        ],
      }),
    ]

    const { schema, nativeRuleIds } = injectConditionsIntoSchema(baseSchema, rules)
    expect(nativeRuleIds.has('r1')).toBe(true)
    expect(schema.discount_code.conditions).toEqual([['has_discount', '==', true]])
    expect(schema.notes.conditions).toEqual([['has_discount', '==', true]])
  })

  it('does not modify the original schema', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'has_discount', event: 'change' },
        conditions: {
          operator: 'and',
          items: [{ field: 'has_discount', op: 'eq', value: true }],
        },
        actions: [{ type: 'show', target: 'discount_code' }],
      }),
    ]

    injectConditionsIntoSchema(baseSchema, rules)
    expect(baseSchema.discount_code.conditions).toBeUndefined()
  })
})
