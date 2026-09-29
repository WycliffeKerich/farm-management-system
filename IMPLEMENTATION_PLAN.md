# Farm Management System - Implementation Plan

> **Revision 2 — 2026-09-29.** This replaces the original 9-phase / 14-week plan.
> Phases 1–3 were delivered as planned. A review of the codebase found security and data-integrity defects, and scope gaps against the farm's real operations. The rest of the roadmap is re-ordered: **harden first, test always, integrate modules through one activity and cost model, then broaden.**
> The review findings behind this revision are summarised in [Current Status](#current-status).

## Project Overview

A farm management system for a Kenyan smallholder farm covering:

- **Crops**: greenhouse crops (tomatoes, capsicum, strawberries) and mushrooms (button and oyster), with:
  - input applications (fertilizers, pesticides), pre-harvest intervals, pest and disease management
  - greenhouse environment logs
  - mushroom-specific records: substrate, spawn run, flushes, contamination
- **Animals**: dairy cows, dairy goats, Dorper sheep and improved Kienyeji chicken, with:
  - feed, health and treatments (including withdrawal periods), breeding and production
- **Beekeeping**: hives as first-class records, with inspections, queen status, varroa monitoring, supers and honey yield per hive.
- **Inventory**: stock ledger with batches (FEFO: first-expiry, first-out) and units of measure. Consumption is linked to the crops and animals it was used on.
- **Finance**: enterprise costing (cost of production per enterprise and per batch), sales, customers and receivables, M-Pesa references, invoices.
- **Workforce**: employees, attendance, leave, Kenyan payroll deductions, tasks and worker quick-log screens.
- **Platform**:
  - unified activity log, audit log, attachments, notifications (in-app / SMS / WhatsApp)
  - scheduled jobs, backups
  - an offline-capable PWA
- **Tech stack**: PostgreSQL 18, Node.js 22 + Express (JavaScript), Vue 3 + PrimeVue 4 (Sakai), Pinia.
- **Future**: Flutter mobile app, with its client generated from the OpenAPI spec.

---

## Current Status

_As of 2026-09-29, on `develop` at commit `82ac4b0`._

### Delivered

| Phase | Module | State |
|---|---|---|
| 1 | Foundation: monorepo, Express, pg-promise, JWT auth, Vue/PrimeVue shell | ✅ Merged |
| 2 | Crop management: types/varieties/locations, batches, observations, harvests, inputs, pests, care plans | ✅ Merged |
| 3 | Animal management: animals/groups, health, treatments, feed, breeding, production, incubation, deaths, care plans | ✅ Merged |
| 4 | Inventory: categories, items, units of measure, batches (FEFO), transactions, frontend | 🟡 **Uncommitted work on `develop`**, not integrated with crops or animals |

### Review findings to fix before building further

These are addressed in **Phase 3.5**.

| # | Severity | Finding | Location |
|---|---|---|---|
| F1 | 🔴 Critical | Registration is public, so anyone can register as `owner` | `routes/auth.routes.js:19`, `validators/auth.validator.js:23` |
| F2 | 🔴 Critical | `BaseRepository` interpolates object keys and `orderBy` straight into SQL, making column-name injection possible | `repositories/base.repository.js` (create/update/find*/count/exists/paginate) |
| F3 | 🔴 Critical | `updateProfile` passes `req.body` through with a denylist, so users can mass-assign columns | `services/auth.service.js:133` |
| F4 | 🔴 Critical | No DB transactions anywhere (no `db.tx`), so stock ledger writes and stock updates can diverge | `services/inventory.service.js` `recordTransaction` |
| F5 | 🔴 Critical | NUMERIC columns come back as strings, so `item.current_stock + stockChange < 0` concatenates and the negative-stock guard never fires | `services/inventory.service.js:282`; no pg type parser registered |
| F6 | 🔴 Critical | FEFO deduction updates batches in a loop, then throws on insufficient stock, leaving partial deductions committed | `repositories/inventory-batch.repository.js:154` |
| F7 | 🟠 High | History tables use `ON DELETE CASCADE`, so deleting a batch, animal, item or employee erases its history, including the inventory ledger | `001_initial_schema.sql` (≈25 FKs) |
| F8 | 🟠 High | Crop service hard-deletes batches, harvests, inputs and pests; animal service has one hard delete | `services/crop.service.js`, `services/animal.service.js` |
| F9 | 🟠 High | About 200 plain `throw new Error(...)` calls in services (crop 51, inventory 36, animal 114) all surface as HTTP 500 | services |
| F10 | 🟠 High | `AuthenticationError` is used but not imported | `controllers/auth.controller.js:87` |
| F11 | 🟠 High | A global limit of 100 requests / 15 min on `/api/` will throttle normal use; login has no dedicated limiter | `app.js:41` |
| F12 | 🟠 High | Access token in `localStorage`; no refresh rotation or revocation (`user_sessions` unused); no password reset (`password_reset_tokens` unused) | `frontend/src/services/api.js:17` |
| F13 | 🟠 High | Frontend router checks only that a token exists; there are no role guards | `frontend/src/router/index.js:299` |
| F14 | 🟡 Medium | Migration runner re-executes every file on every run, with no version table or checksums | `src/database/migrate.js` |
| F15 | 🟡 Medium | Zero tests (`tests/unit` and `tests/integration` are empty); no CI | `packages/backend/tests` |
| F16 | 🟡 Medium | Menu links to Finance, Employees and Tasks routes that don't exist; Sakai demo menu and views still shipped | `layout/AppMenu.vue`, `views/uikit`, `views/pages` |
| F17 | 🟡 Medium | Crop inputs, feed and treatments store products as free text, not inventory items, so no stock deduction, costing or withdrawal tracking | `crop_input_applications`, `animal_feed_records`, `animal_diseases_treatments` |
| F18 | 🟡 Medium | Two production tables: `production_records` (001) and `animal_production_records` (006) | migrations |
| F19 | 🟡 Medium | `animal.service.js` is 2,379 lines | services |
| F20 | 🟡 Medium | Applying a care plan deactivates the animal's existing plan, so an animal can only follow one plan at a time | `animal.service.js:1047–1063` |
| F21 | 🟢 Low | Leftover Mongoose branches in the error middleware; `packages/shared` listed in workspaces but missing; empty `src/database/migrations` and `src/database/seeds` folders; root `build:backend` and `test:frontend` scripts point to scripts that don't exist | various |
| F22 | 🟢 Low | Dashboard shows crop data only; lists paginate client-side | `views/Dashboard.vue` |

---

## Architecture Decisions

### Project Structure
Monorepo with npm workspaces: `packages/backend` and `packages/frontend`. `packages/shared` is created only when there is something real to share (e.g. constants and enums used by both sides); until then it is removed from `workspaces`.

### Backend Architecture
Layered, **Controller → Service → Repository**, with these rules in force from Phase 3.5 onward:

1. **Controllers** parse the request and shape the response. No business logic, no SQL.
2. **Services** own business rules and transaction boundaries:
   - Any operation that writes more than one row runs inside `db.tx(async t => …)`.
   - Services pass the task context `t` down to repositories.
3. **Repositories** do data access only:
   - Every repository declares `columns` (a writable whitelist) and `sortable` (an orderBy whitelist).
   - Identifiers go through pg-promise's `:name` / `$1:name` formatting and are never string-interpolated.
   - Every method accepts an optional `t` (transaction context) and defaults to `db`.
4. **Typed errors only.** Services throw `ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError` or `AuthenticationError` from `utils/errors.js`. A bare `throw new Error` in `services/` fails lint.
5. **Numeric parsing.** pg type parsers are registered once in `config/database.js`: NUMERIC (OID 1700) → `parseFloat`, INT8 (OID 20) → `parseInt`. Money is stored as `NUMERIC(14,2)` and rounded to 2 dp at the service boundary.
6. **Row locking.** Stock movements lock the item row (`SELECT … FOR UPDATE`) before reading balances.
7. **Deletes.**
   - Soft-delete (`deleted_at`) for anything that has history.
   - Foreign keys from history tables use `ON DELETE RESTRICT`.
   - Hard delete only for pure reference data that nothing references.
8. **Files.** Services are kept under roughly 800 lines and split by sub-domain when they grow past that.

### Unified Activity Model
Decided in Phase 5.

Every operational event is also written as a row in `activities`, in the same transaction as the event itself. Events include spraying, feeding, treating, harvesting, milking, inspecting a hive and working on a task.

- The existing detail tables (`crop_input_applications`, `animal_feed_records`, …) remain the source of domain detail. Each detail row carries an `activity_id`.
- **Tasks are planned activities.** Completing a task produces done activities, with labour hours attached.
- Care plans generate planned activities and tasks.
- This gives one farm-wide timeline, one place to roll up **labour and input cost per enterprise**, and a natural offline-sync unit for the PWA and mobile app.

This is the farmOS "logs" pattern, adapted to our relational schema.

### Frontend Architecture
- Vue 3 Composition API (JavaScript), Pinia, PrimeVue 4 with the Sakai layout.
- **Auth tokens.**
  - The access token is held in memory (a Pinia store, not persisted).
  - The refresh token lives in an `httpOnly`, `SameSite=Strict` cookie.
  - The session is restored on reload through `/auth/refresh`.
- **Role-aware routing.** Route `meta.roles` is enforced in `beforeEach`, and the menu is generated from the same route table, so unbuilt or forbidden routes never appear.
- **Shared composables:**
  - `useLazyTable`: server-side pagination, sort and filter, using PrimeVue DataTable lazy mode
  - `useConfirmDelete`
  - `useFormat`: dates, KES, units
  - `useApiError`
- **Worker quick-log screens** are mobile-first, large-touch-target views for the most frequent entries. QR codes on houses, greenhouses, pens and hives deep-link to them.

### Database Design
- PostgreSQL 18 (native install locally; `postgres:18` image in CI and production), normalized, with audit columns (`created_at`, `updated_at`, `created_by`) and soft deletes.
- **Migrations are versioned.**
  - A `schema_migrations` table records filename, checksum and applied time.
  - Each file runs once, inside a transaction.
  - An edited, already-applied migration fails the run.
  - Migrations stay idempotent as a safety net.
- The **inventory ledger (`inventory_transactions`) is the source of truth**. `inventory_items.current_stock` and `inventory_batches.quantity_remaining` are cached projections, maintained in the same transaction and protected by `CHECK (… >= 0)`.
- An **audit log** is written by a Postgres trigger on business tables. The app sets `SET LOCAL app.user_id` inside each transaction so the trigger knows who acted.

---

## Core Database Schema

Tables marked **(exists)** are already in migrations 001–011. **(new)** tables are introduced by the phase noted. **(alter)** means the existing table changes.

### Users, Security & Platform
- `users` (exists). **(alter, 3.5)** `failed_login_count`, `locked_until`, `last_login_at`.
- `user_sessions` (exists; used from 3.5). One row per refresh-token family, with:
  - `token_hash`, `family_id`, `replaced_by`, `revoked_at`, `user_agent`, `ip`, `expires_at`
  - Reuse detection: presenting an already-rotated token revokes the whole family.
- `password_reset_tokens` (exists; used from 3.5). Stores the SHA-256 hash of the token, with a 30-minute expiry and single use.
- `schema_migrations` **(new, 3.5)**: `filename`, `checksum`, `applied_at`.
- `audit_log` **(new, 5)**: `table_name`, `record_id`, `action` (insert/update/delete/soft_delete), `changed_by`, `changed_at`, `before` jsonb, `after` jsonb.
- `attachments` **(new, 5)**: `entity_type`, `entity_id`, `file_name`, `mime_type`, `size_bytes`, `storage_key`, `caption`, `uploaded_by`. Uses local-disk storage behind a `StorageAdapter` interface so it can move to S3-compatible storage later.
- `farm_settings` **(new, 5)**: key → jsonb value with `effective_from`. Holds:
  - currency (KES), timezone (Africa/Nairobi), farm location (lat/long for weather)
  - statutory payroll rates, notification defaults
- `notifications` **(new, 9)** and `notification_preferences` **(new, 9)**.

### Activity & Enterprise Model (Phase 5)
- `enterprises` (exists; **alter**): e.g. Tomatoes GH1, Layers, Dairy, Apiary, Oyster Mushrooms. Adds `enterprise_type`, `unit_of_output` (kg/litre/egg/tray), `is_active`.
- `activities` **(new)**:
  - `activity_type`: input_application, feeding, treatment, vaccination, harvest, production, observation, inspection, task_work, environment_log, …
  - `status`: planned/done/cancelled
  - `planned_for`, `occurred_at`, `enterprise_id`, `location_id`
  - Subject, with one set via a CHECK: `crop_batch_id`, `animal_id`, `animal_group_id`, `hive_id`, `mushroom_batch_id`
  - `performed_by` (employee_id), `labour_hours`, `input_cost`, `other_cost`, `task_id`, `client_request_id` (unique; used for offline idempotency), `notes`
- Detail tables **(alter)** gain `activity_id` FK: `crop_input_applications`, `growth_observations`, `harvests`, `crop_pests_diseases`, `animal_feed_records`, `animal_health_records`, `animal_diseases_treatments`, `animal_production_records`, `hive_inspections`, `honey_harvests`, `mushroom_flushes`, `environment_logs`.
- **Consolidation:** `production_records` (001) is dropped in favour of `animal_production_records` (006), migrating any rows first.

### Crop Management
- (exists) `crop_types`, `crop_varieties`, `growing_locations`, `crop_batches`, `growth_observations`, `harvests`, `crop_input_applications`, `crop_pests_diseases`, `crop_care_plans`, `crop_care_plan_tasks`, `batch_care_schedules`, `scheduled_batch_tasks`.
- **(alter, 4)** `crop_input_applications`:
  - adds `inventory_item_id` (nullable FK), `inventory_transaction_id`, `quantity_base_unit`, `unit_cost`, `total_cost`, `phi_days`, `safe_harvest_date`
  - `product_name` stays as a fallback for off-inventory products
- **(alter, 4)** `crop_batches`: adds `safe_harvest_date` (max over its active applications) and `area_m2` (for yield per m²).
- **(new, 8)** `environment_logs`: `location_id`, `logged_at`, `temp_min_c`, `temp_max_c`, `rh_percent`, `soil_moisture`, `ec`, `ph`, `source` (manual/sensor), `recorded_by`.
- **(new, 8) Mushrooms** (a batch-oriented model, separate from `crop_batches`):
  - `mushroom_batches`: `location_id`, `species`/`strain`, `substrate_recipe`, `dry_substrate_kg`, `treatment_method` (pasteurised/sterilised/lime), `spawn_supplier`, `spawn_kg`, `bags_count`, `spawn_run_start`, `pinning_date`, `status`
  - `mushroom_flushes`: `batch_id`, `flush_no`, `harvest_date`, `fresh_kg`, `grade`
  - `mushroom_contaminations`: `batch_id`, `detected_on`, `contaminant` (trichoderma/cobweb/bacterial/other), `bags_discarded`, `action_taken`
  - Biological efficiency % = Σ fresh_kg / dry_substrate_kg × 100 (computed).

### Animal Management
- (exists) `animal_types`, `animal_breeds`, `animal_housing`, `animals`, `animal_groups`, `animal_group_adjustments`, `animal_health_records`, `animal_diseases_treatments`, `animal_feed_records`, `breeding_records`, `incubation_records`, `animal_deaths`, `animal_production_types`, `animal_production_records`, and the care plan tables.
- **(alter, 4)**:
  - `animal_feed_records` gains `inventory_item_id`, `inventory_transaction_id`, `quantity_base_unit`, `unit_cost`, `total_cost`.
  - Treatments get a child table `treatment_medications` **(new)**: `treatment_id`, `inventory_item_id`, `dose`, `unit`, `route`, `inventory_transaction_id`, `milk_withdrawal_until`, `meat_withdrawal_until`, `egg_withdrawal_until`.
- **(alter, 4)** `animals` and `animal_groups` gain `milk_withdrawal_until`, `meat_withdrawal_until`, `egg_withdrawal_until`.
- **(fix, 5)** Care plans: an animal may follow several plans at once (e.g. vaccination plus deworming). Applying a plan no longer deactivates others.

### Beekeeping (Phase 8)
Beekeeping moves out of generic `animal_groups`.

- `apiaries`: name, location, lat/long.
- `hives`: `apiary_id`, `hive_code` (QR), `hive_type` (Langstroth/KTBH/log), `colony_source` (swarm/split/package), `established_on`, `status` (active/queenless/absconded/dead/merged), `enterprise_id`.
- `hive_inspections`: `hive_id`, `inspected_on`, `queen_seen`, `eggs_seen`, `brood_pattern` (1–5), `temperament` (1–5), `population_frames`, `honey_stores` (low/med/high), `varroa_method` (alcohol wash/sugar roll/sticky board), `varroa_count`, `pests_seen` (SHB/wax moth/ants), `supers_added`, `supers_removed`, `actions`, `next_visit_on`.
- `honey_harvests`: `hive_id`, `harvested_on`, `supers_or_combs`, `honey_kg`, `wax_kg`, `moisture_percent`.
- `hive_events`: queen replaced, split, swarm caught, feeding, merge.

### Inventory Management
- (exists) `inventory_categories`, `units_of_measure`, `inventory_items`, `inventory_batches`, `inventory_transactions`.
- **(alter, 4)** `inventory_items` gains:
  - `active_ingredient`, `pre_harvest_interval_days`
  - `milk_withdrawal_days`, `meat_withdrawal_days`, `egg_withdrawal_days`
  - `reorder_quantity`, `default_supplier_id`
  - `CHECK (current_stock >= 0)`
- **(new, 4)** `suppliers`: name, phone, email, KRA PIN, notes.
- **(alter, 3.5)** `inventory_transactions.item_id` changes to `ON DELETE RESTRICT` (the ledger is permanent).

### Finance (Phase 6)
- (exists, **alter**) `transaction_categories`, `financial_transactions`. The latter gains `enterprise_id` (required for direct costs), `source_type`/`source_id` (for auto-posted rows), `payment_method` (cash/mpesa/bank/cheque), `mpesa_ref`, `attachment_id`.
- **(new)** `customers`: name, type (individual/retailer/hotel/school/broker), phone, email, KRA PIN, credit limit, payment terms (days).
- (exists, **alter**) `sales` becomes a header with `customer_id`, `invoice_no`, `status` (draft/issued/part_paid/paid/void), `due_date`.
- **(new)** `sale_lines`: `sale_id`, `enterprise_id`, product description, `quantity`, `unit`, `unit_price`, `source_type`/`source_id` (harvest, production record, honey harvest, flush).
- **(new)** `payments`: `customer_id`, `received_on`, `amount`, `method`, `mpesa_ref`, `notes`.
- **(new)** `payment_allocations`: `payment_id`, `sale_id`, `amount`. Supports partial payments and receivables aging.
- **(new)** `cost_allocations`: rules for spreading overheads (electricity, water, security, manager salary) across enterprises by fixed % or driver (area, headcount, labour hours).

### Workforce (Phase 7)
- (exists, **alter**) `employees` gains `kra_pin`, `nssf_no`, `shif_no`, `mpesa_phone`, `pay_frequency` (monthly/weekly/daily).
- (exists) `employee_attendance`, `employee_leaves`.
- (exists, **alter**) `employee_salaries` becomes the payslip, with gross, each statutory deduction (PAYE, SHIF, NSSF, Housing Levy), other deductions, net, `payroll_run_id`.
- **(new)** `payroll_runs`: period, status (draft/approved/paid), approved_by, total gross/net. Approving a run auto-posts wage expense by enterprise, using labour hours from `activities` or a default split.
- **(new)** `casual_work_logs`: date, casual worker name/phone (or employee_id), task/activity, days or units (e.g. crates picked), rate, amount, paid_via, `mpesa_ref`.
- (exists, **alter**) `tasks`, `task_assignments`, `task_updates`, `task_checklist_items`. `tasks` gains `enterprise_id`, a subject (batch/animal/group/hive/location), `recurrence_rule`, `source` (manual/care_plan).

---

## API Structure

Base URL: `/api/v1`. The OpenAPI 3.1 spec lives at `packages/backend/openapi/openapi.yaml` from Phase 5 and is served at `/api/v1/docs`.

### Authentication & Users (Phase 3.5)
- `POST /auth/login`: rate-limited per IP and per email; account lock after repeated failures.
- `POST /auth/refresh`: rotates the refresh cookie and detects reuse.
- `POST /auth/logout`: revokes the session.
- `GET /auth/me`, `PUT /auth/me`: the profile update accepts whitelisted fields only.
- `PUT /auth/me/password`
- `POST /auth/forgot-password`, `POST /auth/reset-password`
- `POST /auth/bootstrap`: creates the first owner, and works **only when the users table is empty**. This replaces public `/auth/register`.
- `GET /users`, `POST /users`, `PUT /users/:id`, `PATCH /users/:id/status`, `DELETE /users/:id/sessions`: **owner only**.

### Crop, Animal and Inventory
Existing endpoints stay. The Phase 4 changes:

- `POST /crop-batches/:id/input-applications` accepts `inventory_item_id` + `quantity` + `unit`. This deducts stock (FEFO), costs the application and sets PHI, all in one transaction.
- `POST /feed-records` and `POST /diseases-treatments` (with `medications[]`) behave the same way; treatments set withdrawal dates.
- `POST /crop-batches/:id/harvests` returns **409** while `safe_harvest_date` is in the future, unless the caller is the owner and supplies `override_reason` (the override is audited). Animal production recording works the same way against the withdrawal dates.
- `GET /withdrawals/active`: animals, groups and batches currently under withdrawal or PHI.
- `GET /inventory/valuation`, `GET /inventory/reorder`, `GET/POST/PUT /suppliers`

### Activities & Platform (Phase 5)
- `GET /activities`: a farm-wide timeline, filterable by enterprise, subject, type, date range, employee and status.
- `POST /activities/bulk`: an offline outbox replay, idempotent on `client_request_id`.
- `GET/PUT /settings`
- `POST /attachments` (multipart), `GET /attachments/:id`, `DELETE /attachments/:id`
- `GET /audit-log?table&record_id`: owner only.
- `GET/POST/PUT /enterprises`

### Finance (Phase 6)
- `GET/POST/PUT /financial/transactions`, `GET/POST/PUT /transaction-categories`
- `GET/POST/PUT /customers`, `GET /customers/:id/statement`
- `GET/POST/PUT /sales`, `POST /sales/:id/issue`, `POST /sales/:id/void`, `GET /sales/:id/invoice.pdf`
- `POST /payments` (with allocations), `GET /receivables/aging`
- `GET /reports/profit-loss?enterprise_id&from&to`
- `GET /reports/cost-of-production?enterprise_id&from&to` gives cost per unit of output.
- `GET /reports/batch-costing/:batchId`, `GET /reports/cash-flow?from&to`

### Workforce (Phase 7)
- `GET/POST/PUT /employees`, `POST /employees/:id/attendance`, `GET /attendance?date`
- `GET/POST/PUT /employee-leaves`
- `POST /payroll-runs` (generates a draft), `GET /payroll-runs/:id`, `POST /payroll-runs/:id/approve`, `POST /payroll-runs/:id/mark-paid`, `GET /payslips/:id.pdf`
- `GET/POST /casual-work-logs`
- `GET/POST/PUT /tasks`, `POST /tasks/:id/assign`, `POST /tasks/:id/complete` (creates activities), `GET /tasks/my`, `GET /tasks/calendar`, `GET /tasks/overdue`
- `GET /quick-log/context?qr=<code>` resolves a QR code to its subject and the allowed quick actions.

### Enterprise Depth (Phase 8)
- `/apiaries`, `/hives`, `/hives/:id/inspections`, `/hives/:id/honey-harvests`, `/hives/:id/events`
- `/mushroom-batches`, `/mushroom-batches/:id/flushes`, `/mushroom-batches/:id/contaminations`
- `/environment-logs`, plus `POST /environment-logs/ingest` (API-key auth, for future sensors)

### Dashboard, KPIs & Notifications (Phase 9)
- `GET /dashboard`: role-shaped.
- `GET /kpis?enterprise_id&from&to`
- `GET /notifications`, `POST /notifications/:id/read`, `GET/PUT /notification-preferences`
- `GET /weather/forecast`, `GET /weather/history`
- `GET /export/:module?format=csv`

---

## Implementation Phases (Revised Roadmap)

**Estimated remaining effort: ~16 weeks**, with Phase 3.5 → 10 run in order.

Each phase has its own feature branch off `develop` and must meet the [Definition of Done](#definition-of-done) before it merges.

```
✅ 1 Foundation   ✅ 2 Crops   ✅ 3 Animals
   │
   ▼
3.5 Hardening & Test Harness ───────────── (1.5 wk)  ◀ START HERE
4   Inventory Completion & Integration ─── (1.5 wk)
5   Activity Model & Platform Foundations  (1.5 wk)
6   Finance & Enterprise Costing ───────── (2 wk)
7   Workforce: Tasks + Employees + Payroll (2.5 wk)
8   Enterprise Depth: Bees, Mushrooms, GH  (2 wk)
9   Dashboard, KPIs & Notifications ────── (2 wk)
10  Production Readiness & Offline PWA ─── (3 wk)
    └─▶ Flutter app (separate plan)
```

### Phase 1: Foundation ✅
Monorepo, Express + pg-promise, JWT auth, the Vue 3 + PrimeVue Sakai shell, and Docker Compose for Postgres and pgAdmin.

_Carried forward:_ F1, F2, F3, F10, F11, F12, F13, F14 go to Phase 3.5.

### Phase 2: Crop Management ✅
Crop types, varieties and locations; batches; growth observations; harvests; input applications; pests and diseases; care plans with scheduled tasks.

_Carried forward:_ F7 and F8 (cascades, hard deletes) go to 3.5. F17 (free-text products) and PHI go to 4.

### Phase 3: Animal Management ✅
Animals and groups; health; treatments; feed; breeding; production; incubation; deaths; group adjustments; care plans.

_Carried forward:_
- F17 (feed and medicine as free text) and withdrawal periods go to Phase 4.
- F18 (duplicate production tables) and F20 (one care plan per animal) go to Phase 5.
- F19 (a 2,379-line service) is split incrementally from Phase 4 onward.

---

### Phase 3.5: Hardening & Test Harness (1.5 weeks) ◀ next
**Branch:** `feature/phase-3.5-hardening`

**Goal:** make the existing code safe and correct, and put the test and CI safety net in place, before adding features.

**Step 0: park the Phase 4 work-in-progress.** Commit the uncommitted inventory work to `feature/phase-4-inventory` as a WIP commit, so `develop` is clean. Branch hardening from `develop`. Rebase Phase 4 onto the hardened `develop` afterwards.

**Track A: security and correctness fixes**

| # | Fix | Acceptance check (automated test) |
|---|---|---|
| A1 | Replace public `/auth/register` with `POST /auth/bootstrap` (first owner, empty DB only) and owner-only `POST /users`. `role` is never self-assigned. | Unauthenticated register → 404/403. Bootstrap with existing users → 409. Manager creating an owner → 403. |
| A2 | `BaseRepository`: `columns` whitelist per repository; identifiers formatted via pg-promise `:name`; `orderBy`/direction checked against `sortable`; optional `t` param on every method | Payload key `"name\" = 'x'; --"` is rejected or ignored; unknown sort → 400 |
| A3 | `updateProfile` whitelist (`first_name`, `last_name`, `phone`) | `PUT /auth/me` with `role`, `id` or `password_hash` changes nothing |
| A4 | Register pg type parsers (NUMERIC → float, INT8 → int) | `GET /inventory/items/:id` returns `current_stock` as a JSON number |
| A5 | `recordTransaction`, `useStockFromBatches` and FEFO deduction run in one `db.tx` with `SELECT … FOR UPDATE` on the item; DB `CHECK (current_stock >= 0)` and `CHECK (quantity_remaining >= 0)` | 10 parallel usage requests against stock of 5 → exactly 5 succeed and stock = 0. Insufficient FEFO → no batch changed. |
| A6 | Typed errors across the crop, animal and inventory services; error middleware cleaned (Mongoose branches removed; PG 23505 → 409, 23503 → 409 "in use", 23514/22P02 → 400; unknown → 500 with a generic message in production); ESLint rule bans `throw new Error` in `src/services` | Not-found → 404; duplicate → 409; validation → 400 |
| A7 | Fix the missing `AuthenticationError` import | Covered by auth tests |
| A8 | Rate limiting: remove the global `/api/` 100/15 min limiter; add a login limiter (5 per 15 min per IP + email) and a lighter limiter on `/auth/refresh` and `/auth/forgot-password`; account lock after 10 failures | 6th bad login → 429 |
| A9 | Refresh-token rotation with `user_sessions` (hashed; family reuse detection); logout revokes; access token in memory on the frontend; refresh token in an httpOnly cookie | A reused refresh token → 401 and the whole family revoked |
| A10 | Password reset: `forgot-password` (always 200; token logged in dev, emailed/SMS'd from Phase 9) and `reset-password` (single use, 30 min) | Expired or used token → 400 |
| A11 | Frontend role guards (`meta.roles`); menu generated from routes; remove links to unbuilt modules | A worker cannot navigate to `/inventory/settings` |
| A12 | Soft-delete everywhere history exists; migration `013_restrict_history_fks.sql` changes history-table FKs from `CASCADE` to `RESTRICT` (keeping CASCADE only for true child rows such as checklist items); replace the crop and animal hard deletes | Deleting a batch with harvests → soft-deleted; harvest rows intact |
| A13 | Versioned migration runner (`schema_migrations`, checksum, one tx per file); stop mounting migrations into `docker-entrypoint-initdb.d` | Re-running `npm run migrate` applies nothing new; an edited applied file fails |
| A14 | User management UI (owner): list users, create, change role, deactivate, revoke sessions | Component and integration tests |
| A15 | Cleanup: remove the Sakai demo menu and `views/uikit` and `views/pages` (keep auth pages); drop `packages/shared` from workspaces; delete empty `src/database/{migrations,seeds}`; fix the root `build:backend` and `test:frontend` scripts | CI green |

**Track B: test harness and CI**, built alongside Track A so every fix lands with its test:

1. **Backend:**
   - Jest + Supertest against a real Postgres database `farm_management_test` on the local Postgres (created automatically, using the credentials in `packages/backend/.env`).
   - `globalSetup` creates the database and runs migrations.
   - Each test file truncates the tables it touches (`TRUNCATE … RESTART IDENTITY CASCADE`).
   - Factories: `createUser(role)`, `loginAs(role)`, `createItem()`, `createBatch()`, …
2. **Frontend:** Vitest + Vue Test Utils + jsdom. First suites: the auth store, the api interceptor (refresh-on-401 queue) and the router guard.
3. **CI** (`.github/workflows/ci.yml`):
   - Node 22 and `postgres:18`, matching the local PostgreSQL 18.
   - Steps: `npm ci` → lint → migrate test DB → backend tests with coverage → frontend tests → frontend build.
4. **Coverage gate:** start at 60% of backend lines for the touched modules and raise it per phase.
5. **First suites:** `auth.test.js`, `base.repository.test.js`, `inventory.transactions.test.js` (including concurrency), `errors.middleware.test.js`.

**Deliverables:**
- All F1–F16 and F21 findings closed.
- Tests exist for every fix.
- CI is green and required on PRs into `develop`.

---

### Phase 4: Inventory Completion & Integration (1.5 weeks)
**Branch:** `feature/phase-4-inventory`, rebased on the hardened `develop`.

**Goal:** make inventory the single source for everything the farm consumes, and make safety intervals enforceable.

**Backend:**
1. Rebase the WIP. Bring the inventory repositories and service onto the Phase 3.5 patterns (tx, whitelists, typed errors, parsed numerics).
2. `suppliers` CRUD. Purchases record supplier, unit cost, batch number and expiry.
3. **Integration**, each inside one transaction:
   - **Crop input application** → FEFO usage transaction → cost captured on the application → `safe_harvest_date` recalculated on the batch.
   - **Feed record** → FEFO usage → cost captured. A group feeding creates one transaction.
   - **Treatment medications** → usage per medication → withdrawal dates set on the animal or group.
   - Unit conversion via `units_of_measure`: record in the unit used and deduct in the base unit.
4. **Withdrawal and PHI enforcement:**
   - Harvest, milk and egg production recording is blocked while under withdrawal.
   - The owner can override with a reason, and the override is audited (logged via the Phase 5 audit log; until then, stored on the record).
   - `GET /withdrawals/active`.
5. Stock valuation (batch cost), reorder report, expiring-soon report.
6. Start splitting `animal.service.js`: extract `animal-feed.service.js` and `animal-health.service.js`, since both are touched here.

**Frontend:**
1. Product pickers (autocomplete over inventory items showing stock on hand and unit) in the input application, feed and treatment forms. Free text stays as a fallback option.
2. Withdrawal/PHI badges on batch, animal and group detail pages; a warning dialog when recording a harvest or production during withdrawal.
3. Supplier management; purchase form with batch and expiry; valuation and reorder views.
4. Adopt `useLazyTable` for the inventory lists (server-side pagination).

**Tests:**
- Integration: application → stock decremented → cost stored → PHI set → harvest blocked → owner override allowed.
- Rollback: a failed stock deduction leaves no application row.
- Unit conversion.

**Deliverables:** every spray, feed and dose deducts stock and carries a cost; harvesting or selling produce under withdrawal is prevented.

---

### Phase 5: Activity Model & Platform Foundations (1.5 weeks)
**Branch:** `feature/phase-5-activity-platform`

**Goal:** one timeline and one cost roll-up across modules, plus the cross-cutting platform pieces every later phase needs.

1. **ADR-001: Unified activity model.** Write `docs/adr/001-activity-model.md` covering the decision above, its alternatives (a separate task-only model; pure polymorphic logs) and the consequences.
2. Migration: `activities` table; an `activity_id` column on the detail tables; a backfill script that creates activities for existing detail rows.
3. `ActivityService.record(t, {...})`, called by every detail-writing service inside its transaction. `GET /activities` timeline. `POST /activities/bulk`, idempotent on `client_request_id`.
4. **Enterprises**: CRUD, and link crop batches, animal groups and animals to an enterprise (default derived from type).
5. **Audit log**: a trigger function attached to business tables; `SET LOCAL app.user_id` in the tx helper; owner-only viewer.
6. **Attachments**: upload with a size and MIME whitelist; `StorageAdapter` (local disk); attach to pest incidents, treatments, receipts and inspections.
7. **Settings**: `farm_settings` with typed accessors and a settings page (currency, timezone, farm coordinates).
8. **Consolidation:** migrate `production_records` → `animal_production_records` and drop the former. Fix the care-plan behaviour so an animal can have multiple active plans (F20).
9. **OpenAPI**: create `openapi.yaml` covering auth, users, inventory and activities; serve Swagger UI in dev; lint the spec in CI. From here on, every new endpoint must be in the spec.
10. **Frontend:** a farm timeline view (filterable); a timeline tab on batch, animal and group detail; attachment upload component; settings page.

**Deliverables:** every operational record appears on one timeline with labour and cost; the audit trail answers "who changed what"; photos and documents can be attached.

---

### Phase 6: Finance & Enterprise Costing (2 weeks)
**Branch:** `feature/phase-6-finance`

**Goal:** know what each enterprise earns and costs, down to cost per kg, litre or egg.

**Backend:**
1. Transaction categories (seeded, with income/expense type) and the financial transactions ledger with enterprise, payment method, M-Pesa reference and receipt attachment.
2. **Auto-posting**, idempotent via `source_type`/`source_id`:
   - An inventory purchase posts an expense (cash) to the item's category.
   - Inventory usage is a non-cash cost allocated to the activity's enterprise; it feeds costing, not cash flow.
   - A payroll approval posts wages (from Phase 7).
   - Issuing a sale posts income.
3. **Customers, sales, invoices and receivables:**
   - sale header + lines linked to their source (harvest, production, honey, flush)
   - invoice numbering and PDF invoices (pdfkit)
   - payments with allocations, partial payments, customer statements, aging buckets (0–30, 31–60, 61–90, 90+)
4. **M-Pesa:** record references on payments and expenses. The Daraja C2B/STK integration is deferred to Phase 10 (optional).
5. **Costing engine:**
   - Direct costs: inputs (from activities), labour (hours × employee rate), direct expenses.
   - Overheads via `cost_allocations` rules.
   - Cost of production per enterprise and per batch/group; cost per output unit; gross margin.
6. Reports: P&L (by enterprise and consolidated), cash flow, cost of production, batch costing, sales by customer and product.

**Frontend:**
- Transactions, customers, sales/invoices (issue, void, record payment), receivables dashboard.
- Enterprise P&L and cost-of-production reports with date ranges, Chart.js visualisations and CSV export.

**Tests:**
- Auto-posting idempotency.
- Payment allocation never exceeds the sale balance.
- Aging bucket boundaries.
- Costing arithmetic, using fixtures with known answers.

---

### Phase 7: Workforce: Tasks, Employees & Payroll (2.5 weeks)
**Branch:** `feature/phase-7-workforce`

**Goal:** plan and assign work, capture who did what and for how long, and pay people correctly.

Tasks and employees are built together because tasks need assignees, and labour cost needs task and activity hours.

**Backend:**
1. **Employees:**
   - CRUD, with statutory numbers (KRA PIN, NSSF, SHIF) and M-Pesa phone.
   - Optional link to `users` for system access.
   - Attendance (clock in/out, bulk daily roll-call for managers) and leave (request, approve, balances).
2. **Tasks:**
   - CRUD, subject linkage (batch/animal/group/hive/location), recurrence, checklist, assignments.
   - `complete` creates done activities with labour hours.
   - Care plans generate tasks.
   - My tasks, calendar, overdue.
3. **Payroll:**
   - A payroll run draws on attendance and casual logs.
   - Statutory deductions are computed from `farm_settings` rate tables, which have effective dates: PAYE bands and personal relief, SHIF, NSSF tiers, Affordable Housing Levy.
   - **Rates are never hard-coded.** Seed them with the rates in force at implementation time, verified against KRA, SHA and NSSF publications.
   - Approve → post wages by enterprise → mark paid (M-Pesa references) → payslip PDFs.
4. **Casual work logs**, for daily and piece-rate workers (e.g. crates picked) with weekly payout summaries.
5. **Worker scope:** the worker role sees only their own tasks and the quick-log screens; no finance or payroll.

**Frontend:**
1. Employee list and profile (tabs: attendance, leave, payslips, tasks); daily roll-call screen.
2. Task list, board and calendar; task detail with checklist and timeline.
3. **Worker quick-log** (mobile-first):
   - Big-button actions: Log feeding, Log eggs, Log milk, Log spray, Record mortality, Hive inspection (after Phase 8), Complete my task.
   - Each form pre-fills its subject from context.
4. **QR codes:** printable labels for greenhouses, houses, pens and hives. Scanning opens quick-log for that subject.
5. Payroll run wizard (draft → review → approve → pay); payslip view and print.

**Tests:**
- PAYE, SHIF, NSSF and Housing Levy calculations against worked examples, including band edges.
- Payroll posts wages once.
- Task completion creates activities with hours.
- Worker authorisation boundaries.

---

### Phase 8: Enterprise Depth: Beekeeping, Mushrooms, Greenhouse Environment (2 weeks)
**Branch:** `feature/phase-8-enterprise-depth`

**Goal:** give the farm's specialised enterprises the records they actually need.

1. **Beekeeping:**
   - Apiaries, hives (with QR), inspections (queen, brood, temperament, stores, varroa count and method, pests, supers), honey harvests, hive events (split, swarm, requeen, feed, merge).
   - Migrate any beehive `animal_groups` into `hives`.
   - Alerts: queenless, varroa over threshold, next visit due.
2. **Mushrooms:** mushroom batches (substrate recipe, dry substrate kg, treatment, spawn, bags), spawn run → pinning → flushes, contamination incidents; biological efficiency per batch and per strain.
3. **Greenhouse environment:** manual logs with min/max temperature, RH, EC and pH; charts per greenhouse; sensor-ingest endpoint with API key (hardware later).
4. **Poultry and dairy depth**, as needed by the Phase 9 KPIs: flock daily sheet (eggs, mortality, feed), lactation records, dry-off and calving dates.
5. All of the above write activities and link to enterprises, so costing and the timeline cover them automatically.

**Tests:** BE calculation; varroa threshold alerts; hive migration; activity creation for each new record type.

---

### Phase 9: Dashboard, KPIs & Notifications (2 weeks)
**Branch:** `feature/phase-9-dashboard-notifications`

**Goal:** tell the owner how the farm is doing, and tell everyone what needs attention, without them having to go looking.

1. **KPI catalogue** (`docs/kpis.md`: definition, formula, source tables, target), implemented in `kpi.service.js`:

   | Area | KPIs |
   |---|---|
   | Dairy (cows/goats) | milk per animal per day, lactation yield, calving/kidding interval, days open |
   | Poultry | hen-day production %, FCR, mortality %, feed per bird per day |
   | Sheep | lambing %, weaning weight, mortality |
   | Greenhouse | yield per m² per batch, grade-out %, input cost per kg |
   | Mushrooms | biological efficiency %, contamination rate, yield per bag |
   | Bees | honey kg per hive per season, colony survival %, varroa trend |
   | Finance | gross margin per enterprise, cost per output unit, receivables days |
   | Operations | tasks on-time %, labour hours per enterprise, stock days-of-cover |

2. **Dashboards shaped by role:**
   - Owner: money + KPIs + alerts.
   - Manager: today's work, overdue tasks, withdrawals, low stock.
   - Worker: my tasks + quick-log.
3. **Job scheduler:** pg-boss, which is Postgres-backed so it needs no Redis. Jobs:
   - low stock, expiring batches, withdrawal/PHI ending
   - care-plan and vaccination due, overdue tasks, hive visit due
   - daily digest, nightly KPI snapshot
4. **Notification engine:**
   - `notifications` table plus a channel adapter: in-app, SMS and WhatsApp via Africa's Talking, email optional.
   - Per-user preferences and quiet hours.
   - **Daily digest at 06:00 EAT.**
   - Password-reset delivery goes through this engine.
5. **Weather:** Open-Meteo (no API key) forecast and daily history stored per day for the farm's coordinates; rainfall and temperature on the dashboard and available for yield correlation.
6. CSV export for every list and report.

**Tests:** KPI formulas against fixture data; job idempotency; notification preference filtering; the Africa's Talking adapter mocked.

---

### Phase 10: Production Readiness & Offline PWA (3 weeks)
**Branch:** `feature/phase-10-production`

1. **Offline-capable PWA** (vite-plugin-pwa):
   - app shell cached
   - quick-log and task forms write to an IndexedDB outbox and sync through `POST /activities/bulk` (idempotent)
   - conflict display; "last synced" indicator
2. **Backups:** nightly `pg_dump` with 7 daily / 4 weekly / 6 monthly retention; an off-site copy; attachments folder included; a **documented and rehearsed restore**.
3. **Deployment:**
   - Docker images for the API and frontend (served by Nginx), `docker-compose.prod.yml`
   - TLS via Let's Encrypt, secrets via env files outside the repo, log rotation
   - `/health` and `/ready` endpoints, uptime monitoring
4. **API docs complete:** OpenAPI covers every endpoint. Generate the Dart client (openapi-generator) as the starting point for Flutter.
5. **E2E:** Playwright for login, the spray → harvest-block flow, sale → payment, a payroll run, and offline quick-log sync.
6. **Security review:**
   - dependency audit, CSP headers, upload scanning limits, authz matrix test (every endpoint × every role)
   - load test of the heaviest reports
7. Optional: M-Pesa Daraja C2B/STK integration for automatic payment matching.
8. **User documentation:** role-based guides (owner, manager, worker) with screenshots; a Swahili quick-log guide for workers.

**Deliverables:** v1.0.0 tagged on `main` and deployed; backups verified by a restore drill; the PWA usable offline in the field.

---

## Continuous Refactoring Rules

These apply in every phase: whoever touches the code does the refactor. There is no separate "refactor phase".

- **Split `animal.service.js`** as its areas are touched:
  - feed and health in Phase 4
  - care plans in Phase 5
  - breeding and production in Phase 8
  - Target: nothing over ~800 lines.
- **Server-side pagination:**
  - Any list endpoint that is touched switches to `paginate()` with whitelisted sort and filter.
  - Any list view that is touched switches to `useLazyTable`.
- **No new `throw new Error`**, no multi-write without `db.tx`, no repository without `columns`. Lint and review enforce these.
- **Delete dead code** when found (unused Sakai demo, the Mongoose error branches).
- **Every bug fix ships with a regression test.**

## Definition of Done

A phase (or PR) merges into `develop` only when:

1. Migrations are versioned, idempotent and run cleanly on a fresh DB and on a copy of the current local DB.
2. Integration tests cover each new endpoint's happy path, validation failure, authorization (each role) and not-found.
3. Multi-step writes have a rollback test.
4. CI is green (lint, backend tests, frontend tests, build). Coverage does not drop.
5. The OpenAPI spec is updated (from Phase 5).
6. The menu shows only routes that exist and that the role may access.
7. The feature has been manually tested against the local PostgreSQL with realistic seed data.
8. README and this plan's **Current Status** table are updated.

---

## Key Technologies & Packages

### Backend
- **express**, **pg-promise** (with `pg` type parsers), **express-validator**
- **bcryptjs**, **jsonwebtoken**, **cookie-parser**, **helmet**, **cors**, **express-rate-limit**
- **winston** / **morgan**
- **pg-boss** (jobs, Phase 9), **pdfkit** (invoices and payslips, Phase 6/7), **multer** (uploads, Phase 5)
- **swagger-ui-express** + **@redocly/cli** (OpenAPI serve and lint, Phase 5)
- Africa's Talking SDK (Phase 9)

### Frontend
- **vue** 3, **vue-router**, **pinia**, **primevue** 4 (Sakai), **axios**
- **chart.js**, **date-fns**
- **qrcode** (labels, Phase 7), **vite-plugin-pwa** + **idb** (Phase 10)

### Development & Testing
- **Jest** + **Supertest** (backend), **Vitest** + **@vue/test-utils** (frontend), **Playwright** (E2E, Phase 10)
- **ESLint** + **Prettier**, **GitHub Actions**
- **PostgreSQL 18** (native locally); Docker Compose (Postgres + pgAdmin) optional
- **Node 22 LTS**, via nvm locally

## Security Measures

### Authentication & Authorization
- **Access token:** a 15-minute JWT held in memory.
- **Refresh token:**
  - 7 days, in an httpOnly `SameSite=Strict` cookie, `Secure` in production
  - rotated on every use, with reuse detection that revokes the token family
- **Passwords:** bcrypt (12 rounds); minimum length 10; account lock after 10 failed logins; single-use 30-minute reset tokens.
- **No public registration.** The first owner is bootstrapped, and after that only the owner creates users.
- **RBAC:** Owner, Manager, Worker. The backend is authoritative; frontend guards only improve UX. An authz matrix test runs in CI.

### API Security
- Helmet (including CSP) and a CORS allowlist.
- Rate limiting on login, refresh and forgot-password only.
- **SQL:**
  - parameterised values
  - identifiers only via pg-promise formatting and column/sort whitelists
- Mass-assignment protection via repository `columns` and per-endpoint validators.
- Uploads: MIME and size whitelist, randomised storage keys, never served from the web root.
- Errors: stack traces never leave the server in production.
- An audit log on business tables.

## Critical Files

### Backend
- `packages/backend/src/app.js`: Express app, middleware and limiters
- `packages/backend/src/index.js`: server entry
- `packages/backend/src/config/database.js`: pg-promise instance, type parsers, tx helper
- `packages/backend/src/config/constants.js`: roles and enums
- `packages/backend/src/database/migrate.js`: migration runner (versioned from 3.5)
- `packages/backend/database/migrations/*.sql`: schema (001–011 now)
- `packages/backend/database/seeds/*.sql`: seed data
- `packages/backend/src/repositories/base.repository.js`: base repository (whitelists, tx-aware)
- `packages/backend/src/middleware/auth.middleware.js`: authentication and `authorize(...roles)`
- `packages/backend/src/middleware/error.middleware.js`: error → HTTP mapping
- `packages/backend/src/utils/errors.js`: typed error classes
- `packages/backend/src/routes/index.js`: route registration
- `packages/backend/tests/`: `unit/`, `integration/`, `setup/`, `factories/` (from 3.5)
- `packages/backend/openapi/openapi.yaml`: API contract (from Phase 5)

### Frontend
- `packages/frontend/src/main.js`: app entry
- `packages/frontend/src/router/index.js`: routes, `meta.roles`, guards
- `packages/frontend/src/layout/AppMenu.vue`: menu (generated from routes from 3.5)
- `packages/frontend/src/services/api.js`: axios instance, refresh-on-401 queue
- `packages/frontend/src/stores/auth.store.js`: in-memory token and user
- `packages/frontend/src/composables/`: `useLazyTable`, `useFormat`, `useConfirmDelete`, `useApiError` (from 3.5/4)

### Configuration
- `package.json`: workspaces and root scripts
- `docker-compose.yml`: optional containerised Postgres + pgAdmin (update the image to `postgres:18` in 3.5)
- `.github/workflows/ci.yml`: CI (from 3.5)
- `packages/backend/.env.example`

## Development Workflow

### Local Setup
1. `npm install` at the repo root.
2. **Database:** the local PostgreSQL 18 on `localhost:5432`, db `farm_management`. Credentials are in `packages/backend/.env`; the role has CREATEDB, so the test DB can be created automatically. The docker-compose Postgres + pgAdmin setup is an optional alternative.
3. `cd packages/backend && npm run migrate && npm run seed`. After Phase 3.5, run `npm run migrate -- --baseline` once on the existing local DB so migrations 001–011 are recorded as applied.
4. `npm run dev` at the repo root: backend on `:3000`, frontend on `:5173`.
5. Tests: `npm run test:backend` uses the `farm_management_test` DB on the same container (created automatically by the test global setup).

**Node:** v22 via nvm. Claude Code sessions in this repo load nvm automatically through a SessionStart hook in `.claude/settings.local.json`.

### Branching
`feature/phase-N-name` → PR into `develop` (CI required) → `develop` merges into `main` at release (tagged). Commit messages follow `type(scope): subject`, e.g. `fix(inventory): lock item row during stock deduction`.

## Deployment Considerations
- A single VPS is sufficient: Docker Compose running the API, Nginx serving the frontend, Postgres, TLS via Let's Encrypt.
- Managed Postgres is optional. **Backups and a restore drill are mandatory** (Phase 10).
- **Environment variables:**
  - Backend:
    - `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `NODE_ENV`
    - `COOKIE_SECURE`, `UPLOAD_DIR`
    - `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID` (Phase 9)
  - Frontend: `VITE_API_BASE_URL`.

## Future Mobile App
- It starts after Phase 10, using the Dart client generated from the OpenAPI spec.
- The PWA's offline outbox protocol (`POST /activities/bulk` + `client_request_id`) is the sync contract the Flutter app reuses.
- Recommended packages: `dio` (via the generated client), `riverpod`, `flutter_secure_storage`, `drift` (offline store), `mobile_scanner` (QR), `fl_chart`.

## Success Metrics

Once the roadmap is complete, the system must enable:

1. ✅ Every crop batch tracked from planting to harvest, with inputs deducted from stock, costed, and **PHI-enforced**.
2. ✅ Every animal, group and hive tracked (health, feed, breeding, production), with **withdrawal periods enforced**.
3. ✅ Inventory as a transactional ledger that never goes negative, with FEFO, valuation, reorder and expiry alerts.
4. ✅ **Cost of production and gross margin per enterprise**, and cost per kg, litre or egg.
5. ✅ Sales, invoices, customers, receivables aging and M-Pesa-referenced payments.
6. ✅ Employees, attendance, leave and **Kenya-compliant payroll** with configurable statutory rates.
7. ✅ Tasks as planned activities, with labour hours flowing into costing; worker quick-log via QR.
8. ✅ Beekeeping, mushroom and greenhouse-environment records specific to those enterprises.
9. ✅ Role-shaped dashboards with the KPI catalogue; daily digest and SMS/WhatsApp alerts.
10. ✅ A secure multi-user system: no public registration, rotated refresh tokens, an audit log, an authz matrix test.
11. ✅ Offline field use via the PWA; nightly backups with a rehearsed restore.
12. ✅ An OpenAPI-documented API ready for the Flutter client.

## Module Overview

| # | Module | Phase(s) |
|---|---|---|
| 1 | Foundation & Security | 1, 3.5 |
| 2 | Crop Management (incl. PHI, greenhouse environment) | 2, 4, 8 |
| 3 | Animal Management (incl. withdrawal) | 3, 4, 8 |
| 4 | Beekeeping | 8 |
| 5 | Mushrooms | 8 |
| 6 | Inventory | 4 |
| 7 | Activity Timeline, Audit, Attachments, Settings | 5 |
| 8 | Finance & Enterprise Costing | 6 |
| 9 | Workforce: Employees, Payroll, Tasks, Quick-log | 7 |
| 10 | Dashboard, KPIs, Notifications, Weather | 9 |
| 11 | Production Readiness, Offline PWA, Backups | 10 |
