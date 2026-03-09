# Vue Form Builder

A dynamic form builder and renderer — a mini Typeform/Google Forms app. Admins create forms via a custom drag-and-drop builder UI, forms are stored as Vueform-compatible JSON schemas in PostgreSQL, and users fill forms rendered dynamically with responses saved to the backend.

## Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Frontend | Vue 3, Vite, TypeScript, Tailwind CSS, Vueform, vue-draggable-plus |
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
│   │   ├── pages/           # FormsList, FormBuilder, FormRenderer, ResponsesList
│   │   ├── components/      # CanvasFieldCard, FieldEditor, FieldPalette, FormPreview
│   │   ├── composables/     # useSchemaBuilder (fields[] ↔ Vueform schema)
│   │   ├── services/        # Axios API client
│   │   ├── router/          # Vue Router config
│   │   └── App.vue
│   └── vueform.config.ts
├── backend/           # NestJS API
│   └── src/
│       ├── forms/           # Form entity, CRUD controller & service, DTOs
│       ├── responses/       # Response entity, submit/list controller & service
│       ├── app.module.ts    # TypeORM + PostgreSQL config
│       └── main.ts          # CORS, ValidationPipe
└── docker-compose.yml # PostgreSQL 16
```

## Database

PostgreSQL runs via Docker Compose. Two tables:

- **`forms`** — `id` (UUID), `name`, `description`, `schema` (jsonb), `createdAt`, `updatedAt`
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
