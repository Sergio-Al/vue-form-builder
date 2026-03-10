# Validation & Behavior Rules Engine — Implementation Plan

A visual rules engine for the Vue Form Builder that lets admins define field-level behaviors (auto-populate, clear, show/hide, conditional validation) using a node-graph editor powered by [Vue Flow](https://vueflow.dev/).

---

## Table of Contents

1. [Overview](#overview)
2. [Rule Types](#rule-types)
3. [Data Model](#data-model)
4. [Phase 1 — Rule JSON Format & Runtime Engine](#phase-1--rule-json-format--runtime-engine)
5. [Phase 2 — Vue Flow Visual Editor](#phase-2--vue-flow-visual-editor)
6. [Phase 3 — Show/Hide via Vueform Conditions](#phase-3--showhide-via-vueform-conditions)
7. [Phase 4 — Server-Side Conditional Validation](#phase-4--server-side-conditional-validation)
8. [File Changes Summary](#file-changes-summary)
9. [Risks & Mitigations](#risks--mitigations)

---

## Overview

Currently the form builder supports static per-field validation (`required`, `email`, `numeric`, custom rules string). There is no way to express **inter-field logic** — behaviors that depend on the value of another field.

This plan adds a **rules engine** that supports:

- Filling fields based on the value of another field
- Clearing/resetting fields based on selections elsewhere
- Showing/hiding fields conditionally
- Making fields required only when conditions are met
- Disabling fields dynamically

Rules are authored visually in a Vue Flow node graph, stored as JSON alongside the form schema, evaluated at runtime on the frontend, and mirrored on the backend for secure validation.

---

## Rule Types

| Rule Type | Trigger | Action | Example |
| --- | --- | --- | --- |
| **Auto-populate** | Field A changes | Set Field B's value | Country = "US" → Currency = "USD" |
| **Clear/Reset** | Field A changes | Clear Field B's value | Plan = "Free" → clear payment fields |
| **Show/Hide** | Field A changes | Show or hide Field B | Has discount code? Yes → show code input |
| **Conditional required** | Field A changes | Toggle required on Field B | Age < 18 → guardian name is required |
| **Disable** | Field A changes | Disable/enable Field B | Read-only when status = "Locked" |
| **Set options** | Field A changes | Replace Field B's dropdown items | Country changes → update State/Province list |

---

## Data Model

### New Column: `rules` (jsonb)

Add a `rules` column to the `forms` table, stored as an array of `Rule` objects.

```
forms
├── id          UUID (PK)
├── name        varchar
├── description varchar (nullable)
├── schema      jsonb              ← existing Vueform schema
├── rules       jsonb              ← NEW: array of Rule objects
├── createdAt   timestamp
└── updatedAt   timestamp
```

### Rule JSON Structure

```typescript
interface Rule {
  id: string                        // unique rule ID (UUID or nanoid)
  name: string                      // human-readable label, e.g. "Set currency from country"
  enabled: boolean                  // toggle rule on/off without deleting
  trigger: {
    field: string                   // field name that triggers the rule
    event: 'change'                 // event type (start with "change" only)
  }
  conditions: ConditionGroup        // AND/OR tree of conditions
  actions: Action[]                 // executed when conditions evaluate to TRUE
  elseActions: Action[]             // executed when conditions evaluate to FALSE (optional)
}

interface ConditionGroup {
  operator: 'and' | 'or'
  items: (Condition | ConditionGroup)[]   // allows nested AND/OR logic
}

interface Condition {
  field: string                     // field name to evaluate
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
     | 'contains' | 'not_contains'
     | 'is_empty' | 'is_not_empty'
     | 'in' | 'not_in'
  value?: any                       // comparison value (omitted for is_empty/is_not_empty)
}

interface Action {
  type: 'set_value'                 // set a field's value
      | 'clear_value'              // clear a field's value
      | 'show'                     // show a field
      | 'hide'                     // hide a field
      | 'set_required'            // make a field required
      | 'remove_required'         // remove required from a field
      | 'set_options'             // replace dropdown/radio/checkbox items
      | 'disable'                 // disable a field
      | 'enable'                  // enable a field
  target: string                   // target field name
  value?: any                      // for set_value, set_options
}
```

### Vue Flow Metadata

Each rule also stores its visual layout for Vue Flow:

```typescript
interface RuleFlowMeta {
  ruleId: string
  nodes: VueFlowNode[]             // position, type, data for each node
  edges: VueFlowEdge[]             // connections between nodes
}
```

This is stored in a separate `flowMeta` property inside the `rules` jsonb column (or as a sibling key) so the runtime engine can ignore it and only consume the logical rule definitions.

---

## Phase 1 — Rule JSON Format & Runtime Engine

**Goal:** Define the rule structure, build the frontend runtime engine, and test with hand-written rules. No UI yet.

### 1.1 Backend: Add `rules` Column

**Files to change:**

- `backend/src/forms/form.entity.ts` — add `rules` column:
  ```typescript
  @Column({ type: 'jsonb', default: [] })
  rules: Rule[];
  ```
- `backend/src/forms/dto/create-form.dto.ts` — add optional `rules` field with `@IsOptional()` and `@IsArray()`
- `backend/src/forms/dto/update-form.dto.ts` — inherits from `PartialType(CreateFormDto)`, should get it automatically

**Database migration:**
```sql
ALTER TABLE forms ADD COLUMN rules jsonb NOT NULL DEFAULT '[]';
```

### 1.2 Shared: Rule Type Definitions

Create a shared types file used by both the runtime engine and (later) the Vue Flow editor.

**New file:** `frontend/src/types/rules.ts`

Contains: `Rule`, `ConditionGroup`, `Condition`, `Action`, `RuleFlowMeta` interfaces as defined above.

### 1.3 Frontend: Rules Runtime Engine Composable

**New file:** `frontend/src/composables/useRulesEngine.ts`

```
useRulesEngine(rules: Rule[], formData: Ref<Record<string, any>>)
```

**Responsibilities:**

1. **Build a dependency graph** — map each trigger field to its rules
2. **Watch for changes** — when a field value changes, find all rules triggered by that field
3. **Evaluate conditions** — walk the AND/OR condition tree against current form data
4. **Execute actions** — apply the matching actions (set value, clear, show/hide, etc.) to form data or a reactive visibility/required map
5. **Topological ordering** — if Rule A sets Field X, and Rule B triggers on Field X, execute them in dependency order
6. **Cycle detection** — on initialization, validate the dependency graph is a DAG. Log a warning and skip cyclic rules

**Exported reactive state:**

```typescript
{
  visibilityMap: Record<string, boolean>     // field name → visible
  requiredMap: Record<string, boolean>       // field name → required
  disabledMap: Record<string, boolean>       // field name → disabled
  optionsMap: Record<string, Item[]>         // field name → dynamic options
  onFieldChange(fieldName: string, value: any): void
}
```

### 1.4 Frontend: Integrate Engine into FormRenderer

**File to change:** `frontend/src/pages/FormRenderer.vue`

- Load `rules` from the API response (already included in the form object once the entity is updated)
- Initialize `useRulesEngine(rules, formData)`
- Bind the engine's `onFieldChange` to Vueform's `@change` event
- Apply `visibilityMap`, `requiredMap`, `disabledMap` to the rendered schema dynamically (modify schema object before passing to `<Vueform>`, or use Vueform's programmatic API)

### 1.5 Testing Phase 1

- Write unit tests for `useRulesEngine` — condition evaluation, action execution, cycle detection
- Create a test form with hand-written rules in the database and verify behaviors in the renderer
- **New file:** `frontend/src/__tests__/useRulesEngine.spec.ts`

### Phase 1 Deliverables

- [x] `rules` column exists on `forms` table
- [x] DTOs accept `rules` in create/update
- [x] Type definitions for Rule, Condition, Action
- [x] `useRulesEngine` composable with full evaluation logic
- [x] FormRenderer integrates the engine
- [x] Unit tests pass for condition evaluation and cycle detection

---

## Phase 2 — Vue Flow Visual Editor

**Goal:** Build a visual node-graph editor where admins create and edit rules using drag-and-drop.

### 2.1 Install Dependencies

```bash
cd frontend
npm install @vue-flow/core @vue-flow/background @vue-flow/controls @vue-flow/minimap
```

### 2.2 Custom Vue Flow Node Types

**New directory:** `frontend/src/components/rules/`

| File | Node Type | Description |
| --- | --- | --- |
| `TriggerNode.vue` | **Trigger** | Dropdown to select trigger field + event. Green left border. One output handle. |
| `ConditionNode.vue` | **Condition** | Dropdowns for field, operator, value. Yellow left border. One input handle, two output handles (True / False). |
| `ConditionGroupNode.vue` | **Condition Group** | AND/OR toggle wrapping multiple conditions. Collapsible. |
| `ActionNode.vue` | **Action** | Dropdown for action type, target field, value input. Blue left border. One input handle. |
| `BranchNode.vue` | **Branch** | Visual If/Else fork — routes True edge to actions, False edge to else-actions. |

Each custom node receives the list of available field names (from the form schema) as props so dropdowns are always in sync.

### 2.3 Rules Editor Page

**New file:** `frontend/src/pages/RulesEditor.vue`

**Route:** `/forms/:id/rules`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Builder    Form: "Contact Form"    [Save]    │
├──────────┬──────────────────────────────────────────────┤
│ Rules    │                                              │
│ List     │          Vue Flow Canvas                     │
│          │                                              │
│ • Rule 1 │   [Trigger] ──► [Condition] ──► [Action]    │
│ • Rule 2 │                      │                       │
│ + New    │                 [Else Action]                │
│          │                                              │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│ Minimap                                      Zoom ± Fit │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Left sidebar: list of rules for the form, click to load in canvas, toggle enabled/disabled
- Canvas: Vue Flow instance with custom nodes
- Add rule: creates a default Trigger → Condition → Action chain
- Delete rule: removes from list
- Save: serializes all Vue Flow nodes/edges into the `Rule[]` JSON format and PATCHes the form

### 2.4 Serialization: Vue Flow ↔ Rule JSON

**New file:** `frontend/src/composables/useRuleSerializer.ts`

Two functions:

- `flowToRule(nodes, edges): Rule` — converts Vue Flow graph into a `Rule` object
  - Finds the Trigger node → extracts `trigger`
  - Walks edges from Trigger → Conditions → builds `ConditionGroup`
  - Collects Action nodes on "true" edges → `actions[]`
  - Collects Action nodes on "false" edges → `elseActions[]`

- `ruleToFlow(rule): { nodes, edges }` — converts a `Rule` back into positioned Vue Flow nodes
  - Auto-layout: trigger on the left, conditions in the middle, actions on the right
  - Uses a simple horizontal layout algorithm (or dagre/elkjs for complex graphs)

### 2.5 Validation on Save

Before saving, validate:

- Every rule has exactly one Trigger node
- Every Condition has field + operator filled
- Every Action has type + target filled
- No cycles in the dependency graph across all rules (field A → rule sets B → rule triggers on B → sets A)
- Warn on duplicate rules (same trigger + same conditions)

### 2.6 Router & Navigation

**File to change:** `frontend/src/router/index.ts`

Add route:
```typescript
{
  path: '/forms/:id/rules',
  name: 'rules-editor',
  component: () => import('@/pages/RulesEditor.vue'),
}
```

**File to change:** `frontend/src/pages/FormBuilder.vue`

Add a "Rules" button/tab in the builder toolbar that navigates to `/forms/:id/rules`. Only visible when editing an existing form (needs a saved ID).

**File to change:** `frontend/src/pages/FormsList.vue`

Add a "Rules" action link/button in the forms list table for each form.

### Phase 2 Deliverables

- [x] Vue Flow installed and integrated
- [x] Custom node components: Trigger, Condition, ConditionGroup, Action, Branch
- [x] RulesEditor page with canvas, sidebar, save/load
- [x] Serializer: Flow ↔ Rule JSON (bidirectional)
- [x] Route + navigation from FormBuilder and FormsList
- [x] Graph validation on save (cycle detection, completeness)

---

## Phase 3 — Show/Hide via Vueform Conditions

**Goal:** Leverage Vueform's native `conditions` property for show/hide rules, injecting them into the schema at render time.

### 3.1 Understand Vueform's Native Conditions

Vueform supports conditions natively:
```json
{
  "discount_code": {
    "type": "text",
    "label": "Discount Code",
    "conditions": [
      ["has_discount", "==", true]
    ]
  }
}
```

This is more performant than manual show/hide because Vueform handles the DOM and validation state internally.

### 3.2 Schema Injection

**File to change:** `frontend/src/composables/useRulesEngine.ts`

Add a method:
```typescript
injectConditionsIntoSchema(schema: Record<string, any>, rules: Rule[]): Record<string, any>
```

For every rule where:
- All actions are `show` or `hide`
- Conditions reference only fields (not computed values)
- The condition tree is a flat AND (no nested OR)

→ Convert the rule into Vueform-native `conditions` arrays and inject them into the target field's schema entry.

For rules that are too complex for Vueform's conditions syntax, fall back to the imperative engine.

### 3.3 Hybrid Mode

The runtime engine from Phase 1 handles:
- `set_value`, `clear_value`, `set_options`, `disable`, `enable`, `set_required`, `remove_required`
- Complex show/hide with nested OR conditions

Vueform native conditions handle:
- Simple show/hide (flat AND conditions, single field comparisons)

The `injectConditionsIntoSchema` step runs once when the form loads. The imperative engine runs continuously on field changes.

### Phase 3 Deliverables

- [x] `injectConditionsIntoSchema` function
- [x] Rules with simple show/hide converted to Vueform conditions
- [x] Complex rules still handled by the imperative engine
- [x] Both paths tested side by side

---

## Phase 4 — Server-Side Conditional Validation

**Goal:** Mirror the condition evaluation logic on the backend so that conditional required fields are enforced even if the frontend is bypassed.

### 4.1 Shared Condition Evaluator

**New file:** `backend/src/responses/evaluate-conditions.ts`

Port the condition evaluation logic from `useRulesEngine` (frontend) to a pure TypeScript function:

```typescript
function evaluateConditionGroup(
  group: ConditionGroup,
  data: Record<string, any>
): boolean
```

This is a pure function with no Vue dependencies — just object/value comparisons.

### 4.2 Extend Response Validation

**File to change:** `backend/src/responses/validate-response.ts`

Current flow:
1. Whitelist keys against schema
2. Check required fields
3. Sanitize strings

New flow:
1. Whitelist keys against schema
2. **Load rules for the form**
3. **Evaluate condition-based required rules against submitted data**
4. **Merge static required (from schema) + dynamic required (from rules)**
5. Check required fields (using merged map)
6. Sanitize strings

### 4.3 Extend Response Service

**File to change:** `backend/src/responses/responses.service.ts`

- Load the form's `rules` alongside `schema` when validating a response submission
- Pass both to the updated `validateResponseData` function

### 4.4 Conditional Validation Rules to Enforce

Only a subset of rule actions need server-side mirroring:

| Action | Server-side? | Reason |
| --- | --- | --- |
| `set_required` | **Yes** | Must validate required fields server-side |
| `remove_required` | **Yes** | Must not reject fields that are conditionally not required |
| `set_value` | No | Auto-populate is a frontend convenience |
| `clear_value` | No | Frontend convenience |
| `show` / `hide` | **Partial** | Hidden fields should be stripped from submitted data |
| `disable` | No | Frontend convenience |
| `set_options` | **Optional** | Could validate value is in allowed options set |

### Phase 4 Deliverables

- [x] `evaluateConditionGroup` ported to backend
- [x] `validateResponseData` uses rules for conditional required
- [x] Hidden fields stripped from response data
- [x] Integration tests for conditional validation

---

## File Changes Summary

### New Files

| File | Phase | Description |
| --- | --- | --- |
| `frontend/src/types/rules.ts` | 1 | Rule, Condition, Action type definitions |
| `frontend/src/composables/useRulesEngine.ts` | 1 | Runtime engine composable |
| `frontend/src/__tests__/useRulesEngine.spec.ts` | 1 | Unit tests for the engine |
| `frontend/src/components/rules/TriggerNode.vue` | 2 | Vue Flow trigger node |
| `frontend/src/components/rules/ConditionNode.vue` | 2 | Vue Flow condition node |
| `frontend/src/components/rules/ConditionGroupNode.vue` | 2 | Vue Flow AND/OR group node |
| `frontend/src/components/rules/ActionNode.vue` | 2 | Vue Flow action node |
| `frontend/src/components/rules/BranchNode.vue` | 2 | Vue Flow if/else branch node |
| `frontend/src/pages/RulesEditor.vue` | 2 | Rules editor page |
| `frontend/src/composables/useRuleSerializer.ts` | 2 | Flow ↔ Rule JSON serialization |
| `backend/src/responses/evaluate-conditions.ts` | 4 | Server-side condition evaluator |

### Modified Files

| File | Phase | Change |
| --- | --- | --- |
| `backend/src/forms/form.entity.ts` | 1 | Add `rules` jsonb column |
| `backend/src/forms/dto/create-form.dto.ts` | 1 | Add optional `rules` field |
| `frontend/src/pages/FormRenderer.vue` | 1 | Integrate `useRulesEngine` |
| `frontend/src/services/api.ts` | 1 | No change needed (rules come with form object) |
| `frontend/src/router/index.ts` | 2 | Add `/forms/:id/rules` route |
| `frontend/src/pages/FormBuilder.vue` | 2 | Add "Rules" navigation button |
| `frontend/src/pages/FormsList.vue` | 2 | Add "Rules" action in list |
| `frontend/src/composables/useRulesEngine.ts` | 3 | Add `injectConditionsIntoSchema` |
| `backend/src/responses/validate-response.ts` | 4 | Conditional required evaluation |
| `backend/src/responses/responses.service.ts` | 4 | Load rules during validation |

### Dependencies to Install

| Package | Phase | Purpose |
| --- | --- | --- |
| `@vue-flow/core` | 2 | Node graph canvas |
| `@vue-flow/background` | 2 | Grid/dot background |
| `@vue-flow/controls` | 2 | Zoom/fit controls |
| `@vue-flow/minimap` | 2 | Overview minimap |

---

## Risks & Mitigations

### 1. Cyclic Dependencies

**Risk:** Rule A sets Field X → Rule B triggers on Field X → sets Field Y → Rule C triggers on Field Y → sets Field X.

**Mitigation:**
- Build a directed graph of field dependencies on save
- Run cycle detection (DFS / Kahn's algorithm) and reject save with a clear error message
- At runtime, track a "currently evaluating" set and skip re-entrant triggers

### 2. Performance on Large Forms

**Risk:** A form with 50+ fields and 20+ rules could cause excessive re-evaluation on every keystroke.

**Mitigation:**
- Index rules by trigger field — only evaluate rules relevant to the changed field
- Debounce `onFieldChange` (e.g., 150ms for text inputs, immediate for selects/checkboxes)
- Topological sort ensures each rule evaluates at most once per change cascade

### 3. Vueform Conditions Impedance Mismatch

**Risk:** Vueform's native conditions are limited (flat field comparisons only). Complex rules can't use them.

**Mitigation:**
- Hybrid approach: use native conditions for simple show/hide, imperative engine for everything else
- Document clearly which rules use which path
- Test both paths independently

### 4. Admin UX Complexity

**Risk:** Node graphs can be intimidating for non-technical admins.

**Mitigation:**
- Pre-built templates: "When X equals Y, do Z" — one-click to create a common rule pattern
- Constrained node types — admins pick from dropdowns, never write code
- Rule list sidebar with plain-English summaries (e.g., "When Country = US → Set Currency to USD")
- Consider a "simple mode" (form-based rule editor) alongside the graph for basic rules

### 5. Schema Drift

**Risk:** Admin renames a field in the builder, but rules still reference the old name.

**Mitigation:**
- When a field is renamed in the builder, scan `rules` for references to the old name and offer to update them
- On rules editor load, validate all field references and highlight broken ones in red
- Store field references by name (not ID) to keep rules human-readable, but add a validation pass

### 6. Server-Side Evaluation Divergence

**Risk:** Frontend and backend condition evaluators produce different results.

**Mitigation:**
- Extract condition evaluation into a pure function with identical logic on both sides
- Share test cases: same input → same output
- Consider a shared JSON schema for the evaluator that can be tested against both implementations

---

## Example: End-to-End Rule

**Scenario:** A contact form where selecting Country = "United States" auto-fills Currency to "USD" and shows a State dropdown.

### Rule JSON

```json
{
  "id": "rule_1",
  "name": "US country → set currency & show state",
  "enabled": true,
  "trigger": {
    "field": "country",
    "event": "change"
  },
  "conditions": {
    "operator": "and",
    "items": [
      { "field": "country", "op": "eq", "value": "US" }
    ]
  },
  "actions": [
    { "type": "set_value", "target": "currency", "value": "USD" },
    { "type": "show", "target": "state" }
  ],
  "elseActions": [
    { "type": "clear_value", "target": "currency" },
    { "type": "hide", "target": "state" }
  ]
}
```

### Vue Flow Visual

```
[Trigger: country onChange]
        │
        ▼
[Condition: country == "US"]
      /         \
   True         False
     │             │
     ▼             ▼
[Set currency   [Clear currency]
 to "USD"]      [Hide state]
[Show state]
```

### Runtime Behavior

1. User selects Country = "US"
2. `onFieldChange("country", "US")` fires
3. Engine finds Rule "rule_1" → evaluates condition → TRUE
4. Executes: `formData.currency = "USD"`, `visibilityMap.state = true`
5. Vueform re-renders with currency pre-filled and state field visible

### Server-Side Behavior

1. User submits form with `country: "US"` but `state` is empty
2. If there's a conditional required rule for `state` when `country == "US"`, the server evaluates the condition
3. Condition is TRUE → `state` is required → validation fails → 400 error
