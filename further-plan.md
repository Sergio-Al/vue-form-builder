# Further Improvements Plan

Remaining features and fixes organized by priority, based on the full codebase review. Critical issues have already been resolved (response validation, input sanitization, production DB sync, rate limiting, cascade delete fix).

---

## High Priority

### 1. Pagination for forms list and responses

**Problem:** `GET /api/forms` and `GET /api/forms/:id/responses` return all records at once — won't scale.

**Changes:**
- `backend/src/forms/forms.controller.ts` — add `@Query()` params: `page` (default 1), `limit` (default 20, max 100)
- `backend/src/forms/forms.service.ts` — use TypeORM `.skip()` / `.take()` in `findAll()`, return `{ data, total, page, limit }`
- `backend/src/responses/responses.controller.ts` — same pagination on `findByForm()`
- `backend/src/responses/responses.service.ts` — same `.skip()` / `.take()` in `findByFormId()`
- `frontend/src/pages/FormsList.vue` — add page controls, update API calls
- `frontend/src/pages/ResponsesList.vue` — add page controls
- `frontend/src/services/api.ts` — update `getForms()` and `getResponses()` to accept `page`/`limit` params

### 2. Global error handling (backend)

**Problem:** Unhandled exceptions return raw NestJS error objects. No consistent API error format.

**Changes:**
- Create `backend/src/common/filters/all-exceptions.filter.ts` — catches all exceptions, returns `{ statusCode, message, error, timestamp }`
- `backend/src/main.ts` — register the filter globally with `app.useGlobalFilters()`
- Optionally add request logging with NestJS `Logger`

### 3. Axios interceptor & timeout (frontend)

**Problem:** No timeout on API calls (can hang forever). Errors caught ad-hoc in each component with no consistent handling.

**Changes:**
- `frontend/src/services/api.ts` — add `timeout: 10000` to axios instance config
- Add a response interceptor that extracts error messages and optionally shows a toast notification
- Add a request interceptor for any future auth token injection

### 4. 404 catch-all route (frontend)

**Problem:** Navigating to a bad URL shows a blank page.

**Changes:**
- `frontend/src/router/index.ts` — add a `{ path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound }` route at the end
- Create `frontend/src/pages/NotFound.vue` — simple "Page not found" page with a link back to `/forms`

### 5. Duplicate field name detection

**Problem:** Two fields with the same `name` silently overwrite each other in the Vueform schema (object keys must be unique).

**Changes:**
- `frontend/src/composables/useSchemaBuilder.ts` — add a `duplicateNames` computed that returns field indices with duplicate names
- `frontend/src/components/FieldEditor.vue` or `frontend/src/components/CanvasFieldCard.vue` — show a warning badge when a field has a duplicate name
- `frontend/src/pages/FormBuilder.vue` — prevent save when duplicates exist

### 6. Database indexes

**Problem:** No indexes on frequently queried columns — slow lookups as data grows.

**Changes:**
- `backend/src/forms/form.entity.ts` — add `@Index()` on `createdAt`
- `backend/src/responses/response.entity.ts` — add `@Index()` on `formId` and `createdAt`

---

## Medium Priority

### 7. Replace `alert()` / `confirm()` with proper UI

**Problem:** Native browser dialogs for save errors and delete confirmations — poor UX.

**Changes:**
- Install a lightweight toast library (e.g., `vue-sonner`, MIT) or build a simple toast composable
- `frontend/src/pages/FormBuilder.vue` — replace `alert()` calls with toast notifications; show success toast on save
- `frontend/src/pages/FormsList.vue` — replace `confirm()` with a custom modal dialog component
- Create `frontend/src/components/ConfirmDialog.vue` — reusable confirmation modal

### 8. Prevent double-submit on form renderer

**Problem:** No loading/disabled state on submit button — user can click multiple times.

**Changes:**
- `frontend/src/pages/FormRenderer.vue` — add a `submitting` ref, set to `true` during API call, pass to Vueform or disable the form during submission

### 9. Response export (CSV/JSON)

**Problem:** Admins can view responses in a table but can't export them.

**Changes:**
- `frontend/src/pages/ResponsesList.vue` — add "Export CSV" and "Export JSON" buttons
- Create a utility function that converts the responses array + columns into CSV format and triggers a browser download
- No backend changes needed (data is already available client-side)

### 10. Clean up boilerplate CSS in App.vue

**Problem:** Dead CSS styles from the Vue scaffolding template still in `App.vue`.

**Changes:**
- `frontend/src/App.vue` — remove unused `<style>` rules that came from the Vue create template
- Verify nav styling still works after cleanup

### 11. Swagger/OpenAPI documentation

**Problem:** API has no documentation for external consumers or team reference.

**Changes:**
- Install `@nestjs/swagger` (MIT)
- `backend/src/main.ts` — set up `SwaggerModule.createDocument()` and serve at `/api/docs`
- Add `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` decorators to controllers
- Add `@ApiProperty()` decorators to DTOs

---

## Nice-to-Have (Future)

### 12. Autosave / draft mode in form builder
Save form state to `localStorage` periodically so work isn't lost on accidental page close.

### 13. Undo/redo for field operations
Track field operation history (add, remove, reorder, edit) and allow Ctrl+Z / Ctrl+Shift+Z.

### 14. Form duplication endpoint
`POST /api/forms/:id/clone` — copies a form's schema and name (appended with " (Copy)") as a new form.

### 15. Soft delete for forms and responses
Add `deletedAt` column to both entities. Use TypeORM's `@DeleteDateColumn()` and `.softRemove()` instead of `.remove()`. Add restore endpoints.

### 16. Response analytics / aggregation
Aggregate responses per field (e.g., "60% chose Option A"). Could be a new `GET /api/forms/:id/responses/stats` endpoint or computed client-side.

### 17. Keyboard accessibility for drag-and-drop
Allow arrow keys to reorder fields for users who can't use a mouse. `vue-draggable-plus` doesn't support this natively — would need custom keyboard event handlers.

### 18. Mobile-responsive responses table
The current `<table>` overflows on small screens. Switch to a card-based layout on mobile using Tailwind responsive classes.

### 19. Environment validation with `@nestjs/config`
Use `Joi` or `class-validator` schema in `ConfigModule.forRoot({ validationSchema })` to fail fast on missing/invalid env vars at startup.

### 20. Form publish / unpublish
Add a `published` boolean column to the `forms` entity. Only published forms are accessible via `/f/:id`. Builder can toggle publish state.
