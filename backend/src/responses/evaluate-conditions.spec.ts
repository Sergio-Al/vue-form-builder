import {
  evaluateCondition,
  evaluateConditionGroup,
  evaluateRules,
  Rule,
  Condition,
  ConditionGroup,
} from './evaluate-conditions';
import { validateResponseData } from './validate-response';
import { BadRequestException } from '@nestjs/common';

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
  };
}

// ──────────────────────────────────────────────────────────────────
// evaluateCondition
// ──────────────────────────────────────────────────────────────────

describe('evaluateCondition', () => {
  it('eq — matches loosely', () => {
    expect(evaluateCondition({ field: 'x', op: 'eq', value: 'US' }, { x: 'US' })).toBe(true);
    expect(evaluateCondition({ field: 'x', op: 'eq', value: 1 }, { x: '1' })).toBe(true);
    expect(evaluateCondition({ field: 'x', op: 'eq', value: 'CA' }, { x: 'US' })).toBe(false);
  });

  it('neq', () => {
    expect(evaluateCondition({ field: 'x', op: 'neq', value: 'US' }, { x: 'CA' })).toBe(true);
    expect(evaluateCondition({ field: 'x', op: 'neq', value: 'US' }, { x: 'US' })).toBe(false);
  });

  it('gt / gte / lt / lte', () => {
    expect(evaluateCondition({ field: 'age', op: 'gt', value: 18 }, { age: 20 })).toBe(true);
    expect(evaluateCondition({ field: 'age', op: 'gt', value: 18 }, { age: 18 })).toBe(false);
    expect(evaluateCondition({ field: 'age', op: 'gte', value: 18 }, { age: 18 })).toBe(true);
    expect(evaluateCondition({ field: 'age', op: 'lt', value: 18 }, { age: 10 })).toBe(true);
    expect(evaluateCondition({ field: 'age', op: 'lte', value: 18 }, { age: 18 })).toBe(true);
  });

  it('contains / not_contains', () => {
    expect(evaluateCondition({ field: 'name', op: 'contains', value: 'ohn' }, { name: 'John' })).toBe(true);
    expect(evaluateCondition({ field: 'name', op: 'not_contains', value: 'xyz' }, { name: 'John' })).toBe(true);
  });

  it('is_empty / is_not_empty', () => {
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: '' })).toBe(true);
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: null })).toBe(true);
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: undefined })).toBe(true);
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: [] })).toBe(true);
    expect(evaluateCondition({ field: 'x', op: 'is_empty' }, { x: 'a' })).toBe(false);
    expect(evaluateCondition({ field: 'x', op: 'is_not_empty' }, { x: 'a' })).toBe(true);
  });

  it('in / not_in', () => {
    expect(evaluateCondition({ field: 'x', op: 'in', value: ['a', 'b'] }, { x: 'a' })).toBe(true);
    expect(evaluateCondition({ field: 'x', op: 'in', value: ['a', 'b'] }, { x: 'c' })).toBe(false);
    expect(evaluateCondition({ field: 'x', op: 'not_in', value: ['a', 'b'] }, { x: 'c' })).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// evaluateConditionGroup
// ──────────────────────────────────────────────────────────────────

describe('evaluateConditionGroup', () => {
  it('empty group → true', () => {
    expect(evaluateConditionGroup({ operator: 'and', items: [] }, {})).toBe(true);
  });

  it('AND — all must pass', () => {
    const group: ConditionGroup = {
      operator: 'and',
      items: [
        { field: 'a', op: 'eq', value: 1 },
        { field: 'b', op: 'eq', value: 2 },
      ],
    };
    expect(evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(true);
    expect(evaluateConditionGroup(group, { a: 1, b: 3 })).toBe(false);
  });

  it('OR — any can pass', () => {
    const group: ConditionGroup = {
      operator: 'or',
      items: [
        { field: 'a', op: 'eq', value: 1 },
        { field: 'b', op: 'eq', value: 2 },
      ],
    };
    expect(evaluateConditionGroup(group, { a: 1, b: 99 })).toBe(true);
    expect(evaluateConditionGroup(group, { a: 99, b: 2 })).toBe(true);
    expect(evaluateConditionGroup(group, { a: 99, b: 99 })).toBe(false);
  });

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
    };
    expect(evaluateConditionGroup(group, { a: 1, b: 2, c: 0 })).toBe(true);
    expect(evaluateConditionGroup(group, { a: 1, b: 0, c: 3 })).toBe(true);
    expect(evaluateConditionGroup(group, { a: 1, b: 0, c: 0 })).toBe(false);
    expect(evaluateConditionGroup(group, { a: 0, b: 2, c: 3 })).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// evaluateRules
// ──────────────────────────────────────────────────────────────────

describe('evaluateRules', () => {
  it('set_required when conditions met', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'age', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'age', op: 'lt', value: 18 }] },
        actions: [{ type: 'set_required', target: 'guardian_name' }],
        elseActions: [{ type: 'remove_required', target: 'guardian_name' }],
      }),
    ];

    const result = evaluateRules(rules, { age: 10 });
    expect(result.requiredMap.guardian_name).toBe(true);
  });

  it('remove_required when conditions not met', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'age', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'age', op: 'lt', value: 18 }] },
        actions: [{ type: 'set_required', target: 'guardian_name' }],
        elseActions: [{ type: 'remove_required', target: 'guardian_name' }],
      }),
    ];

    const result = evaluateRules(rules, { age: 25 });
    expect(result.requiredMap.guardian_name).toBe(false);
  });

  it('hide adds fields to hiddenFields set', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'plan', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'plan', op: 'eq', value: 'free' }] },
        actions: [{ type: 'hide', target: 'billing_info' }],
        elseActions: [{ type: 'show', target: 'billing_info' }],
      }),
    ];

    const result = evaluateRules(rules, { plan: 'free' });
    expect(result.hiddenFields.has('billing_info')).toBe(true);

    const result2 = evaluateRules(rules, { plan: 'pro' });
    expect(result2.hiddenFields.has('billing_info')).toBe(false);
  });

  it('skips disabled rules', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        enabled: false,
        trigger: { field: 'age', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'age', op: 'lt', value: 18 }] },
        actions: [{ type: 'set_required', target: 'guardian_name' }],
      }),
    ];

    const result = evaluateRules(rules, { age: 10 });
    expect(result.requiredMap.guardian_name).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// validateResponseData — conditional validation integration
// ──────────────────────────────────────────────────────────────────

describe('validateResponseData with rules', () => {
  const schema = {
    name: { type: 'text', label: 'Name', rules: 'required' },
    age: { type: 'number', label: 'Age' },
    guardian_name: { type: 'text', label: 'Guardian Name' },
    billing_info: { type: 'text', label: 'Billing Info' },
    plan: { type: 'select', label: 'Plan' },
    submit: { type: 'button', label: 'Submit' },
  };

  it('still validates static required fields without rules', () => {
    expect(() =>
      validateResponseData(schema, { age: 25 }),
    ).toThrow(BadRequestException);
  });

  it('passes when static required fields are provided', () => {
    const result = validateResponseData(schema, { name: 'John', age: 25 });
    expect(result.name).toBe('John');
  });

  it('enforces conditional required field when rule conditions are met', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'age', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'age', op: 'lt', value: 18 }] },
        actions: [{ type: 'set_required', target: 'guardian_name' }],
        elseActions: [{ type: 'remove_required', target: 'guardian_name' }],
      }),
    ];

    // Age < 18, guardian_name is required but missing → should throw
    expect(() =>
      validateResponseData(schema, { name: 'Jane', age: 10 }, rules),
    ).toThrow(BadRequestException);

    // Age < 18, guardian_name provided → should pass
    const result = validateResponseData(
      schema,
      { name: 'Jane', age: 10, guardian_name: 'Parent' },
      rules,
    );
    expect(result.guardian_name).toBe('Parent');
  });

  it('does not require conditional field when rule conditions are not met', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'age', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'age', op: 'lt', value: 18 }] },
        actions: [{ type: 'set_required', target: 'guardian_name' }],
        elseActions: [{ type: 'remove_required', target: 'guardian_name' }],
      }),
    ];

    // Age >= 18, guardian_name not required
    const result = validateResponseData(schema, { name: 'John', age: 25 }, rules);
    expect(result.guardian_name).toBeUndefined();
  });

  it('remove_required overrides static required from schema', () => {
    // Schema where guardian_name is statically required
    const schemaWithRequired = {
      ...schema,
      guardian_name: { ...schema.guardian_name, rules: 'required' },
    };

    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'age', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'age', op: 'gte', value: 18 }] },
        actions: [{ type: 'remove_required', target: 'guardian_name' }],
      }),
    ];

    // Age >= 18 → remove_required overrides → should pass without guardian_name
    const result = validateResponseData(
      schemaWithRequired,
      { name: 'John', age: 25 },
      rules,
    );
    expect(result.guardian_name).toBeUndefined();
  });

  it('strips hidden fields from response data', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'plan', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'plan', op: 'eq', value: 'free' }] },
        actions: [{ type: 'hide', target: 'billing_info' }],
      }),
    ];

    const result = validateResponseData(
      schema,
      { name: 'John', plan: 'free', billing_info: 'CC-1234' },
      rules,
    );
    expect(result.billing_info).toBeUndefined();
  });

  it('keeps visible fields in response data', () => {
    const rules: Rule[] = [
      makeRule({
        id: 'r1',
        trigger: { field: 'plan', event: 'change' },
        conditions: { operator: 'and', items: [{ field: 'plan', op: 'eq', value: 'free' }] },
        actions: [{ type: 'hide', target: 'billing_info' }],
        elseActions: [{ type: 'show', target: 'billing_info' }],
      }),
    ];

    const result = validateResponseData(
      schema,
      { name: 'John', plan: 'pro', billing_info: 'CC-1234' },
      rules,
    );
    expect(result.billing_info).toBe('CC-1234');
  });

  it('works with no rules (backward compatible)', () => {
    const result = validateResponseData(schema, { name: 'John' });
    expect(result.name).toBe('John');
  });

  it('excludes button fields from validation', () => {
    const result = validateResponseData(schema, { name: 'John', submit: 'clicked' });
    expect(result.submit).toBeUndefined();
  });
});
