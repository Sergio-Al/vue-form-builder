# Vue Form Builder

A dynamic form builder and renderer — a mini Typeform/Google Forms app. Admins create forms via a custom drag-and-drop builder UI with support for grouped/nested fields, forms are stored as Vueform-compatible JSON schemas in PostgreSQL, and users fill forms rendered dynamically with responses saved to the backend.

## Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Frontend | Vue 3, Vite, TypeScript, Tailwind CSS, Vueform, vue-draggable-plus, Vue Flow |
| Backend  | NestJS, TypeORM                                  |
| Database | PostgreSQL 16 (Docker Compose), `jsonb` columns  |
| State    | Pinia                                            |
| HTTP     | Axios                                            |
| Routing  | Vue Router                                       |

## Project Structure

```
vue-form-project/
├── frontend/          # Vue 3 + Vueform + Tailwind
│   ├── src/
│   │   ├── pages/           # FormsList, FormBuilder, FormRenderer, ResponsesList, RulesEditor
│   │   ├── components/      # CanvasFieldCard, CanvasGroupCard, FieldEditor, FieldPalette, FormPreview
│   │   │   └── rules/       # TriggerNode, ConditionNode, ConditionGroupNode, ActionNode, BranchNode
│   │   ├── composables/     # useSchemaBuilder, useRulesEngine, useRuleSerializer
│   │   ├── types/           # Rule, Condition, Action, RuleFlowMeta type definitions
│   │   ├── services/        # Axios API client
│   │   ├── router/          # Vue Router config
│   │   └── App.vue
│   └── vueform.config.ts
├── backend/           # NestJS API
│   └── src/
│       ├── forms/           # Form entity, CRUD controller & service, DTOs
│       ├── responses/       # Response entity, submit/list controller & service, condition evaluator
│       ├── app.module.ts    # TypeORM + PostgreSQL config
│       └── main.ts          # CORS, ValidationPipe
└── docker-compose.yml # PostgreSQL 16
```

## Database

PostgreSQL runs via Docker Compose. Two tables:

- **`forms`** — `id` (UUID), `name`, `description`, `schema` (jsonb), `rules` (jsonb, default `[]`), `createdAt`, `updatedAt`
- **`responses`** — `id` (UUID), `formId` (FK → forms), `data` (jsonb), `createdAt`

Schemas are stored as Vueform-compatible JSON objects and rendered directly with `<Vueform :schema="..." />` — no translation layer.

## API Endpoints

| Method | Route                      | Description              |
| ------ | -------------------------- | ------------------------ |
| POST   | `/api/forms`               | Create a form            |
| GET    | `/api/forms`               | List all forms           |
| GET    | `/api/forms/:id`           | Get form with schema     |
| PUT    | `/api/forms/:id`           | Update a form            |
| DELETE | `/api/forms/:id`           | Delete a form            |
| POST   | `/api/responses`           | Submit a form response   |
| GET    | `/api/forms/:id/responses` | List responses for a form|

## Frontend Routes

| Path                    | Page            | Purpose                        |
| ----------------------- | --------------- | ------------------------------ |
| `/forms`                | FormsList       | Admin: list & manage forms     |
| `/forms/new`            | FormBuilder     | Admin: create new form         |
| `/forms/:id/edit`       | FormBuilder     | Admin: edit existing form      |
| `/forms/:id/rules`      | RulesEditor     | Admin: visual rules editor     |
| `/forms/:id/responses`  | ResponsesList   | Admin: view form responses     |
| `/f/:id`                | FormRenderer    | Public: fill & submit a form   |

## Environment Variables

Both `backend/` and `frontend/` require `.env` files. Copy the examples and fill in your values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Backend** (`backend/.env`):

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Server port |
| `CORS_ORIGIN` | `http://localhost:5174` | Allowed frontend origin |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASS` | `postgres` | Database password |
| `DB_NAME` | `vueform_builder` | Database name |

**Frontend** (`frontend/.env`):

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | Backend API URL |
| `VITE_VUEFORM_API_KEY` | — | Free API key from [app.vueform.com](https://app.vueform.com) |

## Running Locally

```bash
# 1. Start the database
docker compose up -d

# 2. Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit frontend/.env and add your Vueform API key

# 3. Start the backend (port 3000)
cd backend
npm install
npm run start:dev

# 4. Start the frontend (port 5174)
cd frontend
npm install
npm run dev
```

## Key Design Decisions

- **No auth for MVP** — all routes are public
- **Free Vueform** — custom drag-to-canvas builder UI instead of the paid Builder plugin; requires a free API key from [app.vueform.com](https://app.vueform.com)
- **Drag-and-drop** — fields are dragged from a palette into a center canvas, reordered by dragging, and edited via a static right-side properties panel
- **Schema = Vueform format** — the DB stores the exact JSON object Vueform consumes
- **Submit button in schema** — the builder auto-appends it; the renderer uses `@submit` with `:endpoint="false"`
- **`/api/` prefix** — all backend routes namespaced to avoid frontend route conflicts
- **File uploads excluded from MVP** — the `file` field type renders but uploads don't persist
- **Single-level group nesting** — groups cannot contain other groups to avoid SortableJS nested DOM sync issues
- **Palette-only group children** — only new fields from the palette can be dropped into groups (not existing canvas fields) due to SortableJS limitations with nested lists

## Features

### Form Builder
- **Drag-and-drop field palette** — drag field types (text, email, number, textarea, dropdown, checkbox, checkbox group, radio group, toggle, date, file, section/group) from the left palette onto the canvas
- **Field reordering** — reorder fields on the canvas by dragging via the grip handle
- **Field properties editor** — select any field to edit its name, label, placeholder, required flag, column width, validation rules, and options (for select/radio/checkbox fields) in the right panel
- **Group/Section support** — drag a "Section" from the palette to create a group container; drop new fields into it to build nested form sections. Groups produce Vueform `type: "group"` with a nested `schema`
- **Duplicate & delete** — duplicate or remove any field or group with one click
- **Keyboard navigation** — arrow keys to move selection, Delete/Backspace to remove fields
- **Live preview** — toggle a Vueform-rendered preview of the form while building
- **Live JSON Schema viewer** — toggle a dark-themed JSON panel showing the real-time Vueform schema with a copy-to-clipboard button
- **Rules navigation** — "Rules" button in the builder header links to the visual rules editor (visible when editing an existing form)

### Rules Engine
- **Runtime engine** — `useRulesEngine` composable evaluates rules against live form data, supporting auto-populate, clear, show/hide, conditional required, disable/enable, and dynamic options
- **Condition evaluation** — recursive AND/OR condition tree walker supporting 12 operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `is_empty`, `is_not_empty`, `in`, `not_in`
- **Dependency graph** — rules are topologically sorted by field dependencies; cyclic rules are detected and skipped
- **Cascading evaluation** — when a rule sets a field value, downstream rules triggered by that field are automatically re-evaluated
- **Hybrid show/hide mode** — simple show/hide rules are automatically converted to Vueform native `conditions` arrays for instant, framework-level reactivity; complex rules (OR logic, nested groups, `not_contains` operator) fall back to the imperative engine. Operator mapping: `eq→==`, `neq→!=`, `gt→>`, `gte→>=`, `lt→<`, `lte→<=`, `contains→*`, `is_empty→empty`, `is_not_empty→not_empty`, `in→in`, `not_in→not_in`

### Visual Rules Editor (Vue Flow)
- **Node-graph editor** — build rules visually by placing and connecting nodes on a Vue Flow canvas
- **5 custom node types** — Trigger (green), Condition (yellow), Condition Group (yellow, multi-row), Action (blue), Branch (purple)
- **Rule sidebar** — list of rules with inline rename, enable/disable toggle, and delete
- **Node toolbar** — add Condition Group, Condition, Action, or Branch nodes to the canvas
- **Drag-to-connect** — draw edges between node handles; True paths are green, False paths are red
- **Bidirectional serialization** — `useRuleSerializer` converts between Vue Flow nodes/edges and Rule JSON
- **Flow layout persistence** — node positions and edges are saved as `flowMeta` alongside each rule
- **Validation on save** — checks trigger completeness, condition/action fields, and cross-rule cycle detection
- **Field name sync** — node dropdowns are always populated with current form schema field names

### Supported Rule Types

| Rule Type | Trigger | Action | Example |
| --- | --- | --- | --- |
| **Auto-populate** | Field A changes | Set Field B's value | Country = "US" → Currency = "USD" |
| **Clear/Reset** | Field A changes | Clear Field B's value | Plan = "Free" → clear payment fields |
| **Show/Hide** | Field A changes | Show or hide Field B | Has discount? Yes → show code input |
| **Conditional required** | Field A changes | Toggle required on Field B | Age < 18 → guardian name required |
| **Disable** | Field A changes | Disable/enable Field B | Status = "Locked" → disable editing |
| **Set options** | Field A changes | Replace Field B's dropdown items | Country → update State/Province list |

### Form Renderer
- **Dynamic rendering** — forms are rendered from stored JSON schemas using `<Vueform :schema="..." />`
- **Nested group rendering** — Vueform natively handles `type: "group"` fields
- **Rules integration** — the renderer loads rules from the API, initializes the rules engine, and applies visibility, required, disabled, and options overrides dynamically on field change
- **Native conditions injection** — on mount, eligible show/hide rules are injected as Vueform `conditions` directly into the schema; remaining rules are handled by the imperative engine, avoiding duplicate processing
- **Response submission** — form data is submitted and stored in PostgreSQL

### Server-Side Conditional Validation
- **Condition evaluator** — `evaluate-conditions.ts` mirrors the frontend rules engine on the backend, evaluating conditions and actions (`set_required`, `remove_required`, `show`, `hide`) against submitted data
- **Conditional required enforcement** — fields marked `set_required` by rules are validated as required on the server, even if the static schema doesn't flag them
- **Remove-required override** — `remove_required` actions can override static `required` rules in the schema, allowing rules to relax validation dynamically
- **Hidden field stripping** — fields determined to be hidden by rule evaluation are automatically stripped from submitted data before storage, preventing phantom data
- **Backward compatible** — forms without rules continue to validate using the static schema alone

### Responses Viewer
- **Tabular display** — responses are shown in a table with columns derived from the form schema
- **Nested field display** — group fields are flattened with dot-notation column headers (e.g., `Group › Field`)
