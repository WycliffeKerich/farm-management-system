# Farm Management System - Implementation Prompts & Tests

This document contains structured prompts for each implementation phase, test specifications, and Git/GitHub workflow integration.

---

## Git & GitHub Workflow

### Initial Repository Setup

```bash
# Initialize the repository
git init
git remote add origin https://github.com/WycliffeKerich/farm-management-system.git

# Create main branch protection (do this on GitHub)
# Settings > Branches > Add rule for "main"
# - Require pull request reviews before merging
# - Require status checks to pass before merging
```

### Branch Naming Convention

```
main                    # Production-ready code
develop                 # Integration branch for features
feature/phase-X-name    # Feature branches (e.g., feature/phase-1-foundation)
bugfix/description      # Bug fixes
hotfix/description      # Urgent production fixes
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:

```
feat(auth): implement JWT authentication with refresh tokens
fix(crops): resolve batch filtering by date range
test(animals): add unit tests for feed record service
docs(api): document employee management endpoints
```

### Pull Request Template

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Refactoring
- [ ] Documentation

## Phase/Module

- [ ] Phase 1: Foundation
- [ ] Phase 2: Crop Management
- [ ] Phase 3: Animal Management
- [ ] Phase 3.5: Hardening & Test Harness
- [ ] Phase 4: Inventory Completion & Integration
- [ ] Phase 5: Activity Model & Platform
- [ ] Phase 6: Finance & Enterprise Costing
- [ ] Phase 7: Workforce (Tasks, Employees, Payroll)
- [ ] Phase 8: Enterprise Depth (Bees, Mushrooms, Greenhouse)
- [ ] Phase 9: Dashboard, KPIs & Notifications
- [ ] Phase 10: Production Readiness & PWA

## Testing

- [ ] Integration tests: happy path, validation, authorization (each role), not-found
- [ ] Rollback test for every multi-write
- [ ] Manual testing against the local PostgreSQL

## Definition of Done

- [ ] Migrations versioned and run cleanly on a fresh DB and the current local DB
- [ ] No `throw new Error` in services; multi-row writes use `db.tx`
- [ ] Repositories declare `columns`/`sortable` whitelists
- [ ] OpenAPI spec updated (from Phase 5)
- [ ] Menu shows only built, role-permitted routes
- [ ] README / IMPLEMENTATION_PLAN "Current Status" updated
- [ ] No console.log or debug code
```

### GitHub Actions CI/CD

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      # From Phase 5:
      # - run: npx @redocly/cli lint packages/backend/openapi/openapi.yaml

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18 # match local PostgreSQL 18
        env:
          POSTGRES_USER: farm_admin
          POSTGRES_PASSWORD: farm_password_dev
          POSTGRES_DB: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      NODE_ENV: test
      DB_HOST: localhost
      DB_PORT: 5432
      DB_USER: farm_admin
      DB_PASSWORD: farm_password_dev
      DB_NAME: farm_management_test # created + migrated by jest globalSetup
      JWT_SECRET: test-secret
      JWT_REFRESH_SECRET: test-refresh-secret
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - name: Backend tests (with coverage gate)
        run: npm run test:ci --workspace=packages/backend

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm run test:frontend
      - run: npm run build:frontend
```

Protect `develop` as well as `main`: require the `lint`, `test-backend` and `test-frontend` checks before merging.

---

## Phase 1: Foundation

### Git Workflow for Phase 1

```bash
# Create and checkout feature branch
git checkout -b feature/phase-1-foundation develop

# After completing each major section, commit:
git add .
git commit -m "feat(backend): initialize Express server with middleware"

# Push and create PR when phase is complete
git push -u origin feature/phase-1-foundation
# Create PR: feature/phase-1-foundation -> develop
```

### Prompt 1.1: Project Initialization

```
Initialize a monorepo for the Farm Management System with the following structure:

Root package.json with npm workspaces:
- packages/backend (Node.js/Express API)
- packages/frontend (Vue 3 + Vite)
- packages/shared (shared utilities and constants)

Requirements:
1. Configure workspace scripts for running both apps
2. Add common devDependencies at root (ESLint, Prettier)
3. Create .gitignore for Node.js, Vue, and environment files
4. Create .env.example with required variables
5. Add docker-compose.yml for PostgreSQL and pgAdmin

Tech stack:
- Node.js 20+ with ES6+ JavaScript
- PostgreSQL 15+
- Vue 3.4+ with Vite

Do NOT use TypeScript - use JavaScript with JSDoc comments for documentation.
```

### Prompt 1.2: Backend Express Setup

```
Set up the Express backend in packages/backend with:

1. Express server configuration (src/app.js):
   - JSON body parser
   - CORS configuration
   - Helmet security headers
   - Morgan request logging
   - Error handling middleware

2. Database configuration (src/config/database.js):
   - pg-promise connection with connection pool
   - Environment-based configuration
   - Connection testing function

3. Base repository pattern (src/repositories/base.repository.js):
   - Generic CRUD methods with JSDoc
   - Pagination support
   - Soft delete support

4. Middleware setup:
   - Authentication middleware (placeholder)
   - Validation middleware using express-validator
   - Error handler with proper status codes

5. Route structure:
   - API versioning (/api/v1)
   - Health check endpoint
   - 404 handler

Use JavaScript (ES6+) with JSDoc comments. NO TypeScript.
```

### Prompt 1.3: Database Schema Migration

```
Create the initial database migration (database/migrations/001_initial_schema.sql) with:

1. Users & Authentication:
   - users table (id, email, password_hash, role, first_name, last_name, status, timestamps)
   - user_sessions table (token management)
   - password_reset_tokens table

2. Employee Management:
   - employees table (comprehensive fields per implementation plan)
   - employee_attendance table
   - employee_salaries table
   - employee_leaves table

3. Lookup Tables:
   - crop_types, crop_varieties, growing_locations
   - animal_types, animal_breeds, animal_housing
   - inventory_categories
   - task_categories
   - enterprises, transaction_categories

4. Core Tables:
   - crop_batches, growth_observations, harvests
   - crop_input_applications, crop_pests_diseases
   - animals, animal_groups
   - animal_health_records, animal_diseases_treatments, animal_feed_records
   - breeding_records, production_records
   - inventory_items, inventory_transactions
   - tasks, task_assignments, task_updates, task_checklist_items
   - financial_transactions, sales

Include:
- Primary keys (UUID or SERIAL)
- Foreign key constraints with ON DELETE behavior
- Proper indexes for common queries
- created_at, updated_at, created_by audit fields
- Soft delete (deleted_at) where appropriate
- ENUM types for status fields
```

### Prompt 1.4: JWT Authentication System

```
Implement JWT authentication in the backend:

1. Auth Service (src/services/auth.service.js):
   - login(email, password) - validate credentials, return tokens
   - logout(userId, refreshToken) - invalidate session
   - refreshTokens(refreshToken) - issue new token pair
   - hashPassword(password) - bcrypt with 12 rounds
   - validatePassword(password, hash) - bcrypt compare
   - generateTokens(user) - create access + refresh tokens

2. Auth Controller (src/controllers/auth.controller.js):
   - POST /auth/login
   - POST /auth/logout
   - POST /auth/refresh
   - GET /auth/me

3. Auth Middleware (src/middleware/auth.middleware.js):
   - Verify JWT from Authorization header
   - Attach user to request
   - Handle token expiration
   - Role-based access control helper

4. Token Configuration:
   - Access token: 15 minutes, in response body
   - Refresh token: 7 days, in httpOnly cookie
   - Store refresh tokens in user_sessions table

Include proper error handling and validation.
```

### Prompt 1.5: Frontend Vue Setup

```
Initialize the Vue 3 frontend in packages/frontend:

1. Vite Configuration:
   - Environment variables (VITE_API_BASE_URL)
   - Path aliases (@/ for src)
   - Build optimization

2. PrimeVue + Sakai Theme Setup:
   - Install primevue, primeicons, primeflex
   - Configure Sakai theme layout
   - Set up dark/light mode toggle

3. Vue Router Configuration:
   - Route definitions with meta (requiresAuth, roles)
   - Navigation guards for authentication
   - Lazy loading for route components

4. Pinia Store Setup:
   - Auth store (user, tokens, login/logout actions)
   - UI store (sidebar state, theme, loading states)

5. Axios Configuration (src/services/api.js):
   - Base URL from environment
   - Request interceptor (add auth header)
   - Response interceptor (handle 401, refresh token)
   - Error transformation

6. Layout Components:
   - AppLayout.vue (Sakai sidebar + topbar)
   - AppSidebar.vue (navigation menu)
   - AppTopbar.vue (user menu, notifications)

Use JavaScript with <script setup> syntax. NO TypeScript.
```

### Prompt 1.6: Login Page & Auth Flow

```
Create the authentication UI in the frontend:

1. Login Page (src/views/auth/LoginView.vue):
   - Email and password fields with validation
   - Remember me checkbox
   - Error message display
   - Loading state during login
   - Redirect to dashboard on success

2. Auth Store Integration:
   - Store tokens in memory (access) and cookie (refresh)
   - Persist user data
   - Auto-refresh token before expiration
   - Clear state on logout

3. Protected Routes:
   - Redirect unauthenticated users to login
   - Redirect authenticated users from login to dashboard

4. Dashboard Placeholder:
   - Basic dashboard layout
   - Welcome message with user name
   - Placeholder cards for future KPIs

Use PrimeVue components (InputText, Password, Button, Card, Message).
Include form validation with vee-validate and yup.
```

### Phase 1 Tests

#### Backend Unit Tests

```javascript
// tests/unit/services/auth.service.test.js
describe("AuthService", () => {
  describe("hashPassword", () => {
    it("should hash password with bcrypt");
    it("should generate different hashes for same password");
  });

  describe("validatePassword", () => {
    it("should return true for correct password");
    it("should return false for incorrect password");
  });

  describe("generateTokens", () => {
    it("should generate access and refresh tokens");
    it("should include user id and role in access token");
    it("should set correct expiration times");
  });

  describe("login", () => {
    it("should return tokens for valid credentials");
    it("should throw error for invalid email");
    it("should throw error for invalid password");
    it("should throw error for inactive user");
    it("should create session record");
  });

  describe("refreshTokens", () => {
    it("should return new tokens for valid refresh token");
    it("should throw error for expired refresh token");
    it("should throw error for revoked refresh token");
    it("should invalidate old refresh token");
  });

  describe("logout", () => {
    it("should invalidate refresh token");
    it("should remove session record");
  });
});

// tests/unit/middleware/auth.middleware.test.js
describe("AuthMiddleware", () => {
  describe("authenticate", () => {
    it("should call next() for valid token");
    it("should return 401 for missing token");
    it("should return 401 for invalid token");
    it("should return 401 for expired token");
    it("should attach user to request");
  });

  describe("authorize", () => {
    it("should allow access for permitted role");
    it("should deny access for unpermitted role");
    it("should allow owner access to all resources");
  });
});

// tests/unit/repositories/base.repository.test.js
describe("BaseRepository", () => {
  describe("findAll", () => {
    it("should return paginated results");
    it("should apply filters correctly");
    it("should exclude soft-deleted records");
  });

  describe("findById", () => {
    it("should return record by id");
    it("should return null for non-existent id");
    it("should exclude soft-deleted records");
  });

  describe("create", () => {
    it("should insert record and return with id");
    it("should set created_at timestamp");
  });

  describe("update", () => {
    it("should update record by id");
    it("should set updated_at timestamp");
    it("should return updated record");
  });

  describe("softDelete", () => {
    it("should set deleted_at timestamp");
    it("should not physically delete record");
  });
});
```

#### Backend Integration Tests

```javascript
// tests/integration/auth.test.js
describe("Auth API", () => {
  describe("POST /api/v1/auth/login", () => {
    it("should return 200 with tokens for valid credentials");
    it("should return 400 for missing email");
    it("should return 400 for missing password");
    it("should return 401 for invalid credentials");
    it("should set refresh token cookie");
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should return 200 and clear refresh token");
    it("should return 401 without auth token");
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should return 200 with new tokens");
    it("should return 401 for invalid refresh token");
    it("should return 401 for expired refresh token");
  });

  describe("GET /api/v1/auth/me", () => {
    it("should return 200 with user profile");
    it("should return 401 without auth token");
    it("should not include password hash");
  });
});
```

#### Frontend Unit Tests

```javascript
// tests/unit/stores/auth.store.test.js
describe("AuthStore", () => {
  describe("login", () => {
    it("should set user and tokens on success");
    it("should throw error on invalid credentials");
    it("should set isAuthenticated to true");
  });

  describe("logout", () => {
    it("should clear user and tokens");
    it("should set isAuthenticated to false");
    it("should call API logout endpoint");
  });

  describe("refreshToken", () => {
    it("should update access token");
    it("should logout on refresh failure");
  });

  describe("getters", () => {
    it("isAuthenticated should return correct value");
    it("userRole should return user role");
    it("userName should return formatted name");
  });
});

// tests/unit/services/api.test.js
describe("API Service", () => {
  describe("request interceptor", () => {
    it("should add Authorization header when token exists");
    it("should not add header when no token");
  });

  describe("response interceptor", () => {
    it("should pass through successful responses");
    it("should attempt token refresh on 401");
    it("should logout on refresh failure");
  });
});
```

---

## Phase 2: Crop Management

### Git Workflow for Phase 2

```bash
git checkout develop
git pull origin develop
git checkout -b feature/phase-2-crop-management

# Incremental commits:
git commit -m "feat(crops): add crop types and varieties CRUD"
git commit -m "feat(crops): implement crop batch management"
git commit -m "feat(crops): add input application tracking"
git commit -m "feat(crops): implement pest and disease management"
git commit -m "test(crops): add unit tests for crop services"
git commit -m "feat(frontend): create crop management views"

git push -u origin feature/phase-2-crop-management
```

### Prompt 2.1: Crop Backend CRUD

```
Implement crop management backend endpoints:

1. Crop Types & Varieties:
   - GET/POST /api/v1/crop-types
   - GET/PUT/DELETE /api/v1/crop-types/:id
   - GET/POST /api/v1/crop-varieties
   - Seed data for: Tomatoes, Capsicum, Strawberries, Button Mushrooms, Oyster Mushrooms

2. Growing Locations:
   - GET/POST /api/v1/growing-locations
   - Types: greenhouse, mushroom_house, open_field

3. Crop Batches:
   - Full CRUD endpoints
   - Filter by: status, location, crop_type, date_range
   - Include batch_code generation (e.g., TOM-2024-001)
   - Status: planning, planted, growing, harvesting, completed, failed

4. Services (src/services/crop.service.js):
   - createBatch(data) - with validation
   - updateBatchStatus(id, status) - with state machine
   - getBatchWithHistory(id) - include all related records

5. Repositories with proper queries and indexes

Use JSDoc for all functions. Include validation with express-validator.
```

### Prompt 2.2: Input Applications & Pest/Disease

```
Implement input application and pest/disease tracking:

1. Input Applications:
   - POST /api/v1/crop-batches/:id/input-applications
   - GET /api/v1/crop-batches/:id/input-applications
   - PUT /api/v1/input-applications/:id
   - DELETE /api/v1/input-applications/:id

   Fields: application_date, input_type (fertilizer/pesticide/fungicide/herbicide),
   product_name, quantity, unit, application_method, target_pest_disease,
   weather_conditions, withholding_period, notes

2. Pest & Disease Management:
   - POST /api/v1/crop-batches/:id/pests-diseases
   - GET /api/v1/crop-batches/:id/pests-diseases
   - PUT /api/v1/pests-diseases/:id
   - GET /api/v1/pests-diseases (list all with filters)

   Fields: incident_date, type (pest/disease), name, severity (low/medium/high/critical),
   affected_area_percentage, symptoms, identified_by, control_measures,
   status (active/monitoring/controlled/resolved), resolution_date

3. Services:
   - recordInputApplication(batchId, data)
   - reportPestDisease(batchId, data)
   - updatePestDiseaseStatus(id, status, controlMeasures)
   - getPestDiseaseHistory(batchId)

Link applications to inventory for stock deduction when feature is available.
```

### Prompt 2.3: Growth Observations & Harvests

```
Implement growth tracking and harvest recording:

1. Growth Observations:
   - POST /api/v1/crop-batches/:id/observations
   - GET /api/v1/crop-batches/:id/observations

   Fields: observation_date, growth_stage, height_cm, health_status,
   leaf_condition, notes, photos (file paths), recorded_by

2. Harvests:
   - POST /api/v1/crop-batches/:id/harvests
   - GET /api/v1/crop-batches/:id/harvests
   - GET /api/v1/harvests (list all with filters)

   Fields: harvest_date, quantity, unit, grade (A/B/C), quality_notes,
   harvested_by, destination (storage/sale/processing)

3. Batch Timeline:
   - GET /api/v1/crop-batches/:id/timeline
   - Return chronological list of all events:
     observations, harvests, input applications, pest incidents

4. Statistics:
   - GET /api/v1/crop-batches/:id/statistics
   - Total harvested, yield per plant, input costs, days to harvest
```

### Prompt 2.4: Crop Frontend Views

```
Create crop management frontend views:

1. Crop Dashboard (src/views/crops/CropDashboard.vue):
   - Summary cards: active batches, pending harvests, pest alerts
   - Recent activity feed
   - Quick actions (new batch, record harvest)

2. Batch List (src/views/crops/BatchList.vue):
   - DataTable with sorting, filtering, pagination
   - Status badges with colors
   - Action buttons (view, edit, delete)
   - Filters: crop type, location, status, date range

3. Batch Form (src/views/crops/BatchForm.vue):
   - Crop type dropdown (loads varieties)
   - Location selection
   - Planting date, expected harvest
   - Plant count, spacing
   - Notes field
   - Form validation

4. Batch Detail (src/views/crops/BatchDetail.vue):
   - Batch info card
   - Timeline visualization (observations, inputs, harvests, pests)
   - Tabs: Overview, Observations, Inputs, Harvests, Pests & Diseases
   - Action buttons for each type of record

5. Input Application Form (component):
   - Input type selection
   - Product name with autocomplete from inventory
   - Quantity and unit
   - Application method
   - Weather conditions

6. Pest/Disease Form (component):
   - Type selection (pest/disease)
   - Severity level with visual indicator
   - Affected area slider
   - Symptoms textarea
   - Control measures

Use PrimeVue components throughout. Include loading states and error handling.
```

### Phase 2 Tests

#### Backend Tests

```javascript
// tests/unit/services/crop.service.test.js
describe("CropService", () => {
  describe("createBatch", () => {
    it("should create batch with generated batch_code");
    it("should validate crop_type exists");
    it("should validate location exists");
    it("should set initial status to planning");
    it("should throw error for invalid variety for crop type");
  });

  describe("updateBatchStatus", () => {
    it("should update status for valid transition");
    it("should throw error for invalid status transition");
    it("should set completion_date when status is completed");
  });

  describe("getBatchWithHistory", () => {
    it("should include observations");
    it("should include harvests");
    it("should include input applications");
    it("should include pest/disease records");
    it("should return null for non-existent batch");
  });

  describe("recordInputApplication", () => {
    it("should create input application record");
    it("should validate batch exists");
    it("should deduct from inventory if linked");
  });

  describe("reportPestDisease", () => {
    it("should create pest/disease record");
    it("should set initial status to active");
    it("should validate severity level");
  });

  describe("updatePestDiseaseStatus", () => {
    it("should update status");
    it("should set resolution_date when resolved");
    it("should require control_measures for resolved status");
  });
});

// tests/integration/crops.test.js
describe("Crop API", () => {
  describe("GET /api/v1/crop-batches", () => {
    it("should return paginated batches");
    it("should filter by crop_type");
    it("should filter by status");
    it("should filter by date range");
    it("should require authentication");
  });

  describe("POST /api/v1/crop-batches", () => {
    it("should create new batch");
    it("should return 400 for missing required fields");
    it("should return 404 for invalid crop_type_id");
  });

  describe("POST /api/v1/crop-batches/:id/input-applications", () => {
    it("should record input application");
    it("should return 404 for invalid batch");
    it("should validate input_type enum");
  });

  describe("POST /api/v1/crop-batches/:id/pests-diseases", () => {
    it("should record pest/disease incident");
    it("should return 404 for invalid batch");
    it("should validate severity enum");
  });

  describe("PUT /api/v1/pests-diseases/:id", () => {
    it("should update pest/disease status");
    it("should validate status transition");
  });

  describe("GET /api/v1/crop-batches/:id/timeline", () => {
    it("should return chronological events");
    it("should include all event types");
  });
});
```

#### Frontend Tests

```javascript
// tests/unit/views/BatchForm.test.js
describe("BatchForm", () => {
  it("should render all form fields");
  it("should load crop types on mount");
  it("should load varieties when crop type selected");
  it("should validate required fields");
  it("should submit form data correctly");
  it("should show loading state during submission");
  it("should display validation errors");
  it("should populate form for edit mode");
});

// tests/unit/views/BatchDetail.test.js
describe("BatchDetail", () => {
  it("should load batch data on mount");
  it("should display batch information");
  it("should render timeline correctly");
  it("should show tabs for each section");
  it("should open input application dialog");
  it("should refresh data after recording");
});
```

---

## Phase 3: Animal Management

### Git Workflow for Phase 3

```bash
git checkout develop
git pull origin develop
git checkout -b feature/phase-3-animal-management

# Commits following the same pattern
git push -u origin feature/phase-3-animal-management
```

### Prompt 3.1: Animal Backend Core

```
Implement animal management backend:

1. Animal Types & Breeds:
   - CRUD for animal_types: Chicken (Kienyeji), Dairy Goats, Dobber Sheep, Dairy Cows, Bees
   - CRUD for animal_breeds with type relationship
   - Seed data for specified breeds

2. Animal Housing:
   - CRUD for housing: Coops, Goat Sheds, Sheep Pens, Cow Barns, Apiaries
   - Capacity tracking

3. Individual Animals:
   - Full CRUD with tag_number generation
   - Filter by: type, breed, status, housing, gender
   - Status: active, sold, deceased, culled
   - Birth/purchase date tracking
   - Parent relationships for breeding records

4. Animal Groups:
   - CRUD for flocks (chickens), herds, hives
   - Group type: flock, herd, hive
   - Member count tracking
   - Link to housing

5. Services:
   - registerAnimal(data) - with tag generation
   - transferAnimal(id, newHousing)
   - getAnimalWithHistory(id) - all related records
   - createGroup(data)
   - updateGroupCount(id, count)
```

### Prompt 3.2: Health, Feed & Disease Tracking

```
Implement animal health and feed management:

1. Health Records (preventive care):
   - POST /api/v1/health-records
   - GET /api/v1/animals/:id/health-records
   - GET /api/v1/animal-groups/:id/health-records

   Types: vaccination, deworming, checkup, treatment
   Fields: record_date, type, description, administered_by,
   next_due_date, cost, notes

2. Disease & Treatment Tracking:
   - POST /api/v1/diseases-treatments
   - GET /api/v1/animals/:id/diseases-treatments
   - GET /api/v1/animal-groups/:id/diseases-treatments
   - PUT /api/v1/diseases-treatments/:id

   Fields: diagnosis_date, disease_name, symptoms, severity,
   diagnosis, treatment_plan, medications, treatment_start_date,
   treatment_end_date, veterinarian, cost, status (ongoing/completed/chronic),
   outcome, follow_up_date

3. Feed Records:
   - POST /api/v1/feed-records
   - GET /api/v1/animals/:id/feed-records
   - GET /api/v1/animal-groups/:id/feed-records
   - GET /api/v1/feed-records (with date range, type filters)

   Fields: feed_date, feed_type, feed_name, quantity, unit,
   feeding_time (morning/afternoon/evening), cost_per_unit,
   total_cost, notes

4. Services:
   - recordHealthEvent(animalId, data)
   - diagnoseDiseaseAndTreat(animalId, data)
   - updateTreatmentStatus(id, status, outcome)
   - recordFeeding(animalId/groupId, data)
   - getFeedConsumptionReport(filters)
```

### Prompt 3.3: Breeding & Production

```
Implement breeding and production tracking:

1. Breeding Records:
   - POST /api/v1/breeding-records
   - GET /api/v1/animals/:id/breeding-records
   - PUT /api/v1/breeding-records/:id

   Fields: breeding_date, male_id, female_id, method (natural/artificial),
   expected_birth_date, actual_birth_date, offspring_count,
   offspring_ids, complications, notes, status (pending/successful/failed)

2. Production Records:
   - POST /api/v1/production-records
   - GET /api/v1/animals/:id/production-records
   - GET /api/v1/animal-groups/:id/production-records
   - GET /api/v1/production-records (with filters)

   Types: eggs, milk, honey, wool
   Fields: production_date, type, quantity, unit, quality_grade,
   collection_time, notes

3. Services:
   - recordBreeding(data) - validate animals
   - updateBreedingOutcome(id, data) - link offspring
   - recordProduction(animalId/groupId, data)
   - getProductionSummary(type, dateRange)
   - getBreedingHistory(animalId)
```

### Prompt 3.4: Animal Frontend Views

```
Create animal management frontend views:

1. Animal Dashboard (src/views/animals/AnimalDashboard.vue):
   - Summary: total animals by type, health alerts, production today
   - Upcoming: vaccinations due, expected births
   - Quick actions: add animal, record production, record feeding

2. Animal List (src/views/animals/AnimalList.vue):
   - Tabs for each animal type
   - DataTable with filters (breed, status, housing)
   - Quick view panel on row select
   - Bulk actions (move, health record)

3. Animal Form (src/views/animals/AnimalForm.vue):
   - Type selection (loads breeds)
   - Tag number (auto-generated or manual)
   - Birth/purchase date
   - Housing assignment
   - Parent selection (optional)
   - Status and notes

4. Animal Profile (src/views/animals/AnimalProfile.vue):
   - Animal info with photo
   - Tabs: Health, Diseases, Feed, Breeding, Production
   - Timeline of all events
   - Actions for each record type

5. Group Management (src/views/animals/GroupList.vue):
   - List flocks, herds, hives
   - Member count display
   - Production summary per group

6. Feed Management (src/views/animals/FeedManagement.vue):
   - Record feeding (individual or group)
   - Feed type selection from inventory
   - Quantity and time
   - Consumption history chart

7. Health & Disease (components):
   - Health record form
   - Disease diagnosis form with treatment plan
   - Treatment status update
   - Upcoming vaccinations calendar

Use PrimeVue DataTable, TabView, Dialog, Calendar components.
```

### Phase 3 Tests

#### Backend Tests

```javascript
// tests/unit/services/animal.service.test.js
describe("AnimalService", () => {
  describe("registerAnimal", () => {
    it("should create animal with generated tag");
    it("should validate breed belongs to type");
    it("should validate housing capacity");
    it("should set status to active");
  });

  describe("recordHealthEvent", () => {
    it("should create health record");
    it("should calculate next_due_date for vaccinations");
    it("should link to animal or group");
  });

  describe("diagnoseDiseaseAndTreat", () => {
    it("should create disease treatment record");
    it("should validate animal exists");
    it("should set initial status to ongoing");
  });

  describe("recordFeeding", () => {
    it("should create feed record");
    it("should calculate total cost");
    it("should link to inventory item");
  });

  describe("recordBreeding", () => {
    it("should create breeding record");
    it("should validate male and female are same type");
    it("should validate animals are active");
  });

  describe("recordProduction", () => {
    it("should create production record");
    it("should validate production type matches animal type");
  });
});

// tests/integration/animals.test.js
describe("Animal API", () => {
  describe("POST /api/v1/animals", () => {
    it("should create animal");
    it("should generate unique tag_number");
    it("should return 400 for invalid breed_id");
  });

  describe("POST /api/v1/diseases-treatments", () => {
    it("should create disease treatment");
    it("should validate animal_id or animal_group_id");
  });

  describe("POST /api/v1/feed-records", () => {
    it("should record feeding");
    it("should calculate total_cost");
  });

  describe("GET /api/v1/animals/:id/feed-records", () => {
    it("should return feed history");
    it("should filter by date range");
  });

  describe("POST /api/v1/production-records", () => {
    it("should record production");
    it("should validate quantity is positive");
  });
});
```

---


## Revised Roadmap (2026-09-29)

> Phases 1–3 above are delivered. From here on, the phases follow the revised [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md): **3.5 → 4 → 5 → 6 → 7 → 8 → 9 → 10**.
> Every phase must meet the **Definition of Done** before merging into `develop`:
> - Versioned migrations.
> - Integration tests for happy path, validation, authorization (per role) and not-found.
> - A rollback test for every multi-write.
> - CI green; OpenAPI updated (from Phase 5).
> - The menu shows only built routes.
> - Manually tested against the local PostgreSQL.
>
> **Standing rules for every prompt below:**
> - Services throw typed errors from `utils/errors.js`, never `throw new Error`.
> - Multi-row writes run in `db.tx(async t => …)`, with `t` passed to repositories.
> - Repositories declare `columns` and `sortable` whitelists.
> - Money is `NUMERIC(14,2)`.
> - Lists use server-side pagination.
> - Every bug fix ships with a regression test.

---

## Phase 3.5: Hardening & Test Harness

### Git Workflow for Phase 3.5

```bash
# 0. Park the uncommitted Phase 4 inventory work on its own branch
git checkout -b feature/phase-4-inventory
git add -A && git commit -m "wip(phase-4): inventory module work in progress"
git checkout develop

# 1. Hardening branch from the clean develop
git checkout -b feature/phase-3.5-hardening

# ... work, commit per fix (fix(auth): ..., fix(repo): ..., test(...): ...)

# 2. After merge, rebase inventory onto the hardened develop
git checkout feature/phase-4-inventory
git rebase develop
```

### Prompt 3.5.1: Test Harness First

```
Set up the backend and frontend test harness so every hardening fix lands with a test.

Backend (packages/backend):
1. jest.config.js:
   - testEnvironment node, roots ['<rootDir>/tests']
   - globalSetup tests/setup/global-setup.js, globalTeardown tests/setup/global-teardown.js
   - setupFilesAfterEnv tests/setup/after-env.js
   - coverageThreshold of 60% lines on src/services, src/repositories and src/middleware
2. tests/setup/global-setup.js:
   - Connects to the `postgres` maintenance DB on the local server with the DB_HOST/DB_PORT/DB_USER/DB_PASSWORD from packages/backend/.env (the local role has CREATEDB).
   - Creates `farm_management_test` if it does not exist, then runs the versioned migration runner against it.
   - Tests use DB_NAME=farm_management_test, set via tests/setup/env.js loaded by `setupFiles`.
3. tests/setup/after-env.js: `truncateAll()` helper (TRUNCATE all app tables except schema_migrations RESTART IDENTITY CASCADE), and `afterAll(() => db.$pool.end())`.
4. tests/factories/*.js:
   - createUser({ role }) and loginAs(role), which return { user, accessToken, agent }, where agent is a supertest agent holding the refresh cookie
   - createCategory, createUnit, createItem, createBatch, createCropBatch, createAnimal, createAnimalGroup
5. Export `app` from src/app.js without calling listen, so supertest can use it.
6. Update scripts:
   - backend: "test", "test:unit", "test:integration", "test:ci" (--runInBand --ci --coverage)
   - root: fix "test:frontend" and remove "build:backend"

Frontend (packages/frontend):
1. Add vitest, @vue/test-utils and jsdom. Use the vitest config inside vite.config.js (environment jsdom).
2. Add a "test" script. Tests live in tests/unit/**.

CI: create .github/workflows/ci.yml (template in this document), using Node 22 and postgres:18.

Verify:
- `npm run test:backend` passes locally against the local PostgreSQL, with a smoke test hitting GET /api/v1/health.
- `npm run test:frontend` passes.
```

### Prompt 3.5.2: Auth & Session Hardening

```
Harden authentication (findings F1, F3, F10, F11, F12):

1. Remove public POST /auth/register. Add:
   - POST /auth/bootstrap: creates the first owner, and only if the users table is empty; otherwise 409.
   - Owner-only /users routes: GET list, POST create, PUT update (role, is_active), PATCH /users/:id/status, DELETE /users/:id/sessions (revoke all).
   - Validators never accept `role` from a non-owner.
2. updateProfile whitelists first_name, last_name and phone. Any other key is ignored.
3. Import AuthenticationError in auth.controller.js.
4. Rate limits:
   - Delete the global /api limiter.
   - loginLimiter: 5 attempts / 15 min, keyed by IP + lowercased email.
   - refreshLimiter and forgotLimiter: 30 / 15 min per IP.
   - users.failed_login_count and locked_until: lock for 15 minutes after 10 consecutive failures; reset on success.
5. Refresh tokens:
   - Opaque random 256-bit tokens, stored as SHA-256 in user_sessions with family_id, expires_at, revoked_at, replaced_by, user_agent and ip.
   - Sent as an httpOnly, SameSite=Strict cookie named `rt`, with path=/api/v1/auth and Secure in production.
   - POST /auth/refresh rotates the token. If a token that has already been replaced is presented, the whole family is revoked and the call returns 401 (reuse detection).
   - POST /auth/logout revokes the current session and clears the cookie.
   - The access token stays a 15-minute JWT, returned in the JSON body.
6. Password reset:
   - POST /auth/forgot-password always returns 200. It creates a token, stored as a SHA-256 hash in password_reset_tokens with a 30-minute expiry. In development the link is logged; delivery via the notification engine comes in Phase 9.
   - POST /auth/reset-password consumes the token (single use), sets the new password and revokes all sessions.
7. Password policy: minimum 10 characters; bcrypt with 12 rounds.
8. Frontend:
   - auth.store keeps the access token in memory only.
   - On app start it calls /auth/refresh with credentials to restore the session.
   - The api.js interceptor holds a single in-flight refresh promise and replays queued requests after it; if refresh fails, it logs out.
   - Remove all token reads and writes to localStorage.
9. Add a migration for the users columns failed_login_count, locked_until and last_login_at, and for any missing user_sessions columns.
```

### Prompt 3.5.3: Data Layer Safety

```
Fix the data layer (findings F2, F4, F5):

1. config/database.js:
   - Register pg type parsers: pgp.pg.types.setTypeParser(1700, parseFloat) and setTypeParser(20, v => parseInt(v, 10)).
   - Export a `withTx(userId, fn)` helper. It runs db.tx, executes SET LOCAL app.user_id inside (used by the Phase 5 audit trigger; harmless now), and calls fn(t).
2. BaseRepository:
   - Constructor takes { table, columns, sortable, softDelete }.
   - create/update filter the input to `columns`, and throw ValidationError if nothing is left.
   - Build SQL with pgp.helpers.insert/update, or '$1:name' formatting for identifiers. No string interpolation of identifiers.
   - findBy/count/exists filter keys against columns, plus id/created_at/deleted_at.
   - paginate validates orderBy against `sortable` and direction against ASC/DESC; otherwise it throws ValidationError.
   - Every method takes an optional last argument `t` (defaults to this.db).
   - When softDelete is set, reads exclude deleted_at IS NOT NULL by default.
3. Update every repository to declare columns and sortable.
4. Add unit tests (tests/unit/repositories/base.repository.test.js) that try injection through keys and orderBy.
```

### Prompt 3.5.4: Errors, Deletes, Migrations, Cleanup

```
1. Errors (F9):
   - Replace every `throw new Error(...)` in src/services with the typed errors in utils/errors.js (ValidationError 400, AuthenticationError 401, ForbiddenError 403, NotFoundError 404, ConflictError 409).
   - Add a ESLint no-restricted-syntax rule for `ThrowStatement > NewExpression[callee.name='Error']`, scoped to src/services/**.
   - error.middleware.js:
     - remove the Mongoose branches
     - map pg codes: 23505 → 409 "already exists", 23503 → 409 "record is in use" or 400 "referenced record not found", 23514 → 400, 22P02 → 400
     - never leak the stack or internal message when NODE_ENV=production

2. Deletes (F7, F8):
   - Migration 012_restrict_history_fks.sql: for history tables (harvests, growth_observations, crop_input_applications, crop_pests_diseases, animal_* history tables, inventory_transactions, employee_attendance, employee_salaries, task_updates) change the FK to ON DELETE RESTRICT.
   - Keep CASCADE only for true composition children (e.g. care plan tasks, checklist items).
   - Add deleted_at where it is missing.
   - Crop and animal services soft-delete. Deleting a parent that has active history → soft delete only.

3. Migrations (F14):
   - migrate.js creates schema_migrations(filename PK, checksum, applied_at).
   - It runs each pending file in its own transaction, sorted by filename.
   - It fails loudly if an applied file's checksum changed.
   - `--baseline` flag: marks all existing files as applied without running them (for the current local DB).
   - Remove the migrations mount from docker-compose's docker-entrypoint-initdb.d.

4. Cleanup (F16, F21):
   - Delete the Sakai demo routes and views (views/uikit, views/utilities, and demo pages except auth, notfound and access).
   - Build AppMenu from the router: routes with meta.menu and meta.roles.
   - Add a beforeEach guard enforcing meta.roles; unauthorised navigation goes to /access.
   - Remove packages/shared from the workspaces, and delete the empty src/database/migrations and src/database/seeds folders.

5. User management UI: views/users/UserList.vue and UserForm.vue (owner only).
```

### Prompt 3.5.5: Inventory Correctness Fixes

```
Fix inventory correctness on the parked Phase 4 branch after its rebase, or in 3.5 if the inventory code is merged first:

1. recordTransaction:
   - Runs in one tx.
   - SELECT the item FOR UPDATE, compute the new stock numerically, and throw ConflictError on a negative result.
   - Insert the ledger row, then update current_stock, all with `t`.
2. FEFO deduction (useStockFromBatches):
   - Same tx, and lock the candidate batches FOR UPDATE ORDER BY expiry_date NULLS LAST, received_date.
   - Check the total available BEFORE mutating; if insufficient, throw ConflictError with nothing written.
   - Write one ledger row per batch consumed.
3. Add CHECK constraints: inventory_items.current_stock >= 0 and inventory_batches.quantity_remaining >= 0.
4. Add a reconcile script (npm run inventory:reconcile) that compares current_stock with SUM(ledger) and reports drift.
```

### Phase 3.5 Tests

```javascript
// tests/integration/auth.test.js
describe("Auth API (hardened)", () => {
  describe("POST /auth/bootstrap", () => {
    it("creates the first owner when no users exist");
    it("returns 409 when any user exists");
  });
  describe("public registration", () => {
    it("POST /auth/register returns 404");
  });
  describe("POST /users", () => {
    it("owner can create a manager or worker");
    it("manager gets 403");
    it("worker gets 403");
  });
  describe("POST /auth/login", () => {
    it("returns access token in body and sets httpOnly rt cookie");
    it("returns 401 for wrong password without revealing which field was wrong");
    it("returns 429 after 5 failed attempts for the same email+IP");
    it("locks the account after 10 consecutive failures");
  });
  describe("POST /auth/refresh", () => {
    it("rotates the refresh cookie and returns a new access token");
    it("reusing a rotated token returns 401 and revokes the whole family");
    it("returns 401 after logout");
  });
  describe("PUT /auth/me", () => {
    it("updates first_name, last_name, phone");
    it("ignores role, id, password_hash, is_active in the payload");
  });
  describe("password reset", () => {
    it("forgot-password always returns 200 (no user enumeration)");
    it("reset-password works once, then the token is rejected");
    it("expired token (31 min) is rejected");
    it("reset revokes all existing sessions");
  });
});

// tests/unit/repositories/base.repository.test.js
describe("BaseRepository", () => {
  it("drops keys not in the columns whitelist on create/update");
  it("throws ValidationError when no writable columns remain");
  it('does not execute an injected identifier key like `name" = 1; --`');
  it("rejects orderBy not in sortable with ValidationError");
  it("rejects direction other than ASC/DESC");
  it("uses the provided transaction context t");
  it("excludes soft-deleted rows by default");
});

// tests/unit/config/type-parsers.test.js
describe("pg type parsers", () => {
  it("returns NUMERIC columns as JS numbers");
  it("returns COUNT(*) as a JS number");
});

// tests/integration/inventory.transactions.test.js
describe("Inventory transactions (correctness)", () => {
  it("purchase then usage leaves exact decimal stock (e.g. 10.5 - 0.25 = 10.25)");
  it("usage beyond stock returns 409 and writes nothing");
  it("10 concurrent usages of 1 against stock 5 → 5 succeed, 5 fail, stock = 0");
  it("FEFO consumes earliest-expiry batch first, across multiple batches");
  it("FEFO insufficient stock leaves every batch unchanged (rollback)");
  it("current_stock equals SUM(ledger) after a mixed sequence");
});

// tests/integration/errors.test.js
describe("Error mapping", () => {
  it("unknown id → 404 with typed error body");
  it("duplicate unique value → 409");
  it("deleting a referenced record → 409 'in use'");
  it("malformed UUID/int → 400");
  it("production mode hides internal messages on 500");
});

// tests/integration/soft-delete.test.js
describe("Soft deletes", () => {
  it("deleting a crop batch with harvests soft-deletes it and keeps harvest rows");
  it("soft-deleted records are excluded from list endpoints");
  it("hard DELETE of an inventory item with ledger rows is blocked (RESTRICT)");
});

// tests/unit/database/migrate.test.js
describe("Migration runner", () => {
  it("applies pending files once and records checksum");
  it("second run applies nothing");
  it("fails when an applied file's checksum changes");
  it("rolls back a failing migration file entirely");
});

// frontend: tests/unit/stores/auth.store.test.js, services/api.test.js, router/guard.test.js
describe("auth store", () => {
  it("never writes tokens to localStorage");
  it("restores session via /auth/refresh on init");
});
describe("api interceptor", () => {
  it("performs a single refresh for concurrent 401s and replays all requests");
  it("logs out when refresh fails");
});
describe("router guard", () => {
  it("redirects unauthenticated users to /auth/login");
  it("redirects a worker away from an owner-only route to /access");
  it("menu omits routes the role cannot access");
});
```

---

## Phase 4: Inventory Completion & Integration

### Git Workflow for Phase 4

```bash
git checkout feature/phase-4-inventory
git rebase develop            # develop now contains Phase 3.5
# resolve conflicts, bring code onto the 3.5 patterns, then continue
```

### Prompt 4.1: Inventory Backend Completion

```
Complete the inventory backend on top of the Phase 3.5 patterns:

1. Bring the existing inventory repositories and service onto the standard patterns: columns/sortable whitelists, `t` param, typed errors, numeric types.
2. Suppliers:
   - Migration: suppliers(name, phone, email, kra_pin, notes, is_active, deleted_at).
   - inventory_items.default_supplier_id.
   - Purchases capture supplier_id, unit_cost, batch_number and expiry_date, and create an inventory_batch.
3. Items gain:
   - active_ingredient
   - pre_harvest_interval_days
   - milk_withdrawal_days, meat_withdrawal_days, egg_withdrawal_days
   - reorder_quantity
4. Reports:
   - GET /inventory/valuation: SUM(batch.quantity_remaining × batch.unit_cost) per item and category.
   - GET /inventory/reorder: items with current_stock <= minimum_stock, suggested qty = reorder_quantity.
   - GET /inventory/expiring?days=30: batches.
5. Unit conversion: helper convertToBase(qty, unitId, itemBaseUnitId) using units_of_measure factors. Throws ValidationError for incompatible dimensions (mass vs volume).
```

### Prompt 4.2: Consumption Integration + PHI/Withdrawal

```
Link consumption to inventory and enforce safety intervals. Each operation runs in ONE transaction:

1. Crop input application (POST /crop-batches/:id/input-applications):
   - Accepts inventory_item_id, quantity and unit_id. product_name stays as the fallback when there is no item.
   - Converts to the base unit, deducts FEFO via the inventory service with `t`, and stores inventory_transaction_id, quantity_base_unit, unit_cost (weighted over the batches consumed) and total_cost.
   - Sets application.phi_days from the item and safe_harvest_date = application_date + phi_days.
   - Sets crop_batches.safe_harvest_date = MAX over the batch's non-deleted applications.
2. Feed records: same deduction and costing; for group feeding, one ledger row per batch consumed.
3. Treatments:
   - New child table treatment_medications(treatment_id, inventory_item_id, dose, unit_id, route, inventory_transaction_id, milk/meat/egg_withdrawal_until).
   - POST /diseases-treatments accepts medications[].
   - Sets animals.* or animal_groups.*_withdrawal_until = GREATEST(existing, new).
4. Enforcement:
   - Harvest creation while crop_batches.safe_harvest_date > harvest_date → ConflictError (409) code PHI_ACTIVE, with the safe date in details.
   - Milk, egg or meat production (or death/slaughter with sale) during withdrawal → 409 WITHDRAWAL_ACTIVE.
   - Owner may pass override_reason. It is stored on the record (override_by, override_reason) and logged at warn level.
5. GET /withdrawals/active lists animals, groups and crop batches currently restricted, with their until dates.
6. Refactor: extract animal-feed.service.js and animal-health.service.js out of animal.service.js; the routes stay unchanged.
```

### Prompt 4.3: Inventory Frontend

```
1. Adopt composables/useLazyTable.js (DataTable lazy mode → page, limit, sort, filters) for the item, batch and transaction lists.
2. Supplier list and form. The purchase form has supplier, batch number, expiry and unit cost.
3. Inventory dashboard: valuation total, reorder list, expiring batches, recent transactions.
4. InventoryItemPicker.vue:
   - AutoComplete over items, showing stock on hand + base unit and PHI/withdrawal days.
   - Allows a "not in inventory" free-text fallback.
   - Used in the crop input application, feed and treatment forms.
5. Treatment form: repeatable medications rows.
6. Withdrawal badges on the crop batch, animal and group detail pages ("PHI until 12 Oct", "Milk withdrawal until …"). WithdrawalBoard.vue at /withdrawals.
7. The harvest and production forms show a blocking dialog when the API returns PHI_ACTIVE/WITHDRAWAL_ACTIVE. Owners get an override reason field.
```

### Phase 4 Tests

```javascript
// tests/integration/inventory.test.js
describe("Inventory API", () => {
  it("purchase with supplier creates batch and increases stock");
  it("valuation equals sum of remaining batch qty × cost");
  it("reorder list returns items at/below minimum with reorder_quantity");
  it("expiring returns batches within N days ordered by expiry");
  it("worker cannot create items (403)");
});

// tests/unit/utils/units.test.js
describe("convertToBase", () => {
  it("converts ml → l and g → kg");
  it("rejects mass → volume conversion");
});

// tests/integration/consumption.test.js
describe("Consumption integration", () => {
  it("crop input application deducts stock FEFO and stores cost");
  it("application sets batch safe_harvest_date from item PHI");
  it("second application with longer PHI extends safe_harvest_date");
  it("insufficient stock → 409 and no application row written (rollback)");
  it("free-text product (no item) records application without stock change");
  it("feed record for a group deducts stock and stores cost");
  it("treatment with 2 medications writes 2 ledger rows and sets withdrawal dates");
});

describe("PHI / withdrawal enforcement", () => {
  it("harvest before safe_harvest_date → 409 PHI_ACTIVE");
  it("harvest on/after safe_harvest_date → 201");
  it("milk production during milk withdrawal → 409 WITHDRAWAL_ACTIVE");
  it("owner override with reason → 201 and override recorded");
  it("manager override attempt → 403");
  it("GET /withdrawals/active lists restricted subjects");
});

// frontend
describe("InventoryItemPicker", () => {
  it("shows stock and unit for each option");
  it("emits free-text value when fallback chosen");
});
describe("HarvestForm", () => {
  it("shows PHI dialog on 409 PHI_ACTIVE");
});
```

---

## Phase 5: Activity Model & Platform Foundations

### Git Workflow for Phase 5

```bash
git checkout develop && git pull
git checkout -b feature/phase-5-activity-platform
```

### Prompt 5.1: ADR + Activities

```
1. Write docs/adr/001-activity-model.md. Cover the context (fragmented detail tables, and costing needs), the decision (an activities header table plus detail tables), the alternatives considered, and the consequences.
2. Migration:
   - activities(id, activity_type, status planned|done|cancelled, planned_for, occurred_at, enterprise_id, location_id, crop_batch_id, animal_id, animal_group_id, performed_by → employees, labour_hours NUMERIC(6,2), input_cost NUMERIC(14,2), other_cost NUMERIC(14,2), task_id, client_request_id UNIQUE, notes, created_by, created_at, updated_at, deleted_at)
   - CHECK that at most one subject is set.
   - Add activity_id to the detail tables listed in IMPLEMENTATION_PLAN.md.
3. activity.service.js:
   - record(t, {...}) is called by every detail-writing service in the same tx.
   - Input cost comes from the Phase 4 costing.
4. Backfill script (npm run backfill:activities): creates done activities for existing detail rows; idempotent.
5. GET /activities: paginated, with filters enterprise_id, type, subject, from/to, performed_by, status.
6. POST /activities/bulk:
   - Accepts up to 100 items, each with client_request_id.
   - Items already processed return their existing id.
   - Returns per-item results; partial success is allowed, and each item runs in its own tx.
```

### Prompt 5.2: Enterprises, Audit, Attachments, Settings, Consolidation

```
1. Enterprises:
   - CRUD. Add enterprise_type and unit_of_output.
   - Add enterprise_id to crop_batches, animal_groups and animals, with a backfill based on type.
   - Seed: Tomatoes, Capsicum, Strawberries, Button Mushrooms, Oyster Mushrooms, Dairy Cattle, Dairy Goats, Dorper Sheep, Kienyeji Poultry, Apiary.
2. Audit log:
   - audit_log table, plus a trigger function audit_row() that reads current_setting('app.user_id', true).
   - Attach it to business tables via a migration loop.
   - withTx sets app.user_id.
   - GET /audit-log?table&record_id is owner-only.
3. Attachments:
   - Upload with multer to UPLOAD_DIR. Store under a random key; whitelist image/jpeg, image/png, image/webp and application/pdf; limit 10 MB.
   - StorageAdapter interface { put, get, delete } with a LocalDiskStorage implementation.
   - Access-checked download endpoint.
4. Settings: farm_settings(key, value jsonb, effective_from). settings.service get(key, date) returns the effective value. Seed currency, timezone and farm coordinates.
5. Consolidation:
   - Migrate production_records rows into animal_production_records, then drop production_records.
   - Care plans: remove the deactivate-others behaviour so an animal can have multiple active plans (F20).
6. OpenAPI:
   - packages/backend/openapi/openapi.yaml covering auth, users, inventory, activities, enterprises and settings.
   - Serve /api/v1/docs in non-production.
   - CI step: npx @redocly/cli lint.
7. Frontend:
   - FarmTimeline.vue (/timeline), and a Timeline tab on batch, animal and group detail.
   - AttachmentUploader.vue (gallery and upload).
   - SettingsView.vue and EnterpriseList.vue.
   - AuditLogView (owner).
```

### Phase 5 Tests

```javascript
describe("Activities", () => {
  it("creating a crop input application also creates a done activity in the same tx");
  it("failure in detail insert rolls back the activity");
  it("GET /activities filters by enterprise, type and date range");
  it("bulk: duplicate client_request_id returns the original id, no duplicate row");
  it("bulk: one invalid item does not block the others");
  it("backfill is idempotent");
});
describe("Audit log", () => {
  it("update of an animal writes before/after JSON with changed_by");
  it("only owner can read audit log");
});
describe("Attachments", () => {
  it("rejects disallowed MIME types and files > 10MB");
  it("download requires auth");
});
describe("Settings", () => {
  it("returns the value effective on a given date");
});
describe("Care plans", () => {
  it("an animal can have two active plans simultaneously");
});
describe("OpenAPI", () => {
  it("spec lints cleanly (CI)");
});
```

---

## Phase 6: Finance & Enterprise Costing

### Git Workflow for Phase 6

```bash
git checkout develop && git pull
git checkout -b feature/phase-6-finance
```

### Prompt 6.1: Ledger, Sales, Receivables

```
1. Transaction categories (income/expense, seeded) and financial_transactions:
   - Adds enterprise_id, source_type/source_id (UNIQUE when set), payment_method (cash|mpesa|bank|cheque), mpesa_ref and attachment_id.
   - Money is NUMERIC(14,2).
2. Auto-posting (idempotent via the source_type/source_id unique):
   - An inventory purchase posts an expense.
   - Issuing a sale posts income.
   - Payroll (Phase 7) will post wages.
3. customers:
   - Fields: name, type, phone, email, kra_pin, credit_limit, payment_terms_days, deleted_at.
4. sales and sale_lines:
   - sales header: customer_id, invoice_no (sequence INV-YYYY-#####), sale_date, due_date, status draft|issued|part_paid|paid|void, totals.
   - sale_lines: enterprise_id, description, qty, unit, unit_price, line_total, source_type/source_id linking to a harvest, production record or (later) honey harvest or flush.
5. payments and payment_allocations. Allocation never exceeds the outstanding balance, and the sale status updates in the same tx.
6. GET /receivables/aging (buckets 0-30, 31-60, 61-90, 90+) and GET /customers/:id/statement.
7. Invoice PDF via pdfkit: farm details from settings, lines, totals, payment instructions (M-Pesa paybill/till from settings).
```

### Prompt 6.2: Costing Engine & Reports

```
1. cost_allocations(overhead category → enterprise, method fixed_pct|area|headcount|labour_hours, value, effective_from).
2. costing.service.js:
   - Direct inputs = SUM(activities.input_cost) by enterprise and period.
   - Direct labour = SUM(labour_hours × employee hourly rate), or wages already posted by enterprise.
   - Direct expenses = financial_transactions with an enterprise_id.
   - Overheads are allocated by rule.
   - Output = harvest and production quantities in the enterprise's unit_of_output.
   - Cost per unit = total cost / output.
   - Gross margin = revenue − direct costs.
   - Batch costing = the same calculation scoped to a crop batch or animal group.
3. Reports: profit-loss (by enterprise and consolidated), cost-of-production, batch-costing and cash-flow (cash methods only; excludes non-cash inventory usage).
4. Frontend:
   - Transactions, Customers, Sales (issue, void, record payment), Receivables.
   - Reports with date-range pickers, charts and CSV export.
```

### Phase 6 Tests

```javascript
describe("Finance", () => {
  it("auto-posting the same source twice creates one transaction");
  it("issuing a sale assigns sequential invoice_no and posts income");
  it("payment allocation exceeding balance → 400");
  it("partial payment sets status part_paid; full sets paid");
  it("voiding a paid sale → 409");
  it("aging buckets place a 31-day-old invoice in 31-60");
  it("worker cannot access finance endpoints (403)");
});
describe("Costing (fixture with known answers)", () => {
  it("cost per kg for a tomato batch = (inputs + labour + direct) / kg harvested");
  it("overhead allocated 60/40 by fixed_pct lands on the right enterprises");
  it("cash flow excludes non-cash inventory usage");
});
```

---

## Phase 7: Workforce: Tasks, Employees & Payroll

### Git Workflow for Phase 7

```bash
git checkout develop && git pull
git checkout -b feature/phase-7-workforce
```

### Prompt 7.1: Employees, Attendance, Leave

```
1. Employees:
   - CRUD. Adds kra_pin, nssf_no, shif_no, mpesa_phone, pay_frequency, daily_rate / monthly_salary, and an optional user_id link.
   - Soft delete. Statutory numbers are visible to owners only.
2. Attendance:
   - Clock in/out.
   - POST /attendance/roll-call: bulk for a date.
   - Unique (employee_id, date).
3. Leave: request → approve/reject (manager/owner), with balances per leave type per year.
4. casual_work_logs: date, worker name/phone or employee_id, activity/task, units, rate, amount, paid_via, mpesa_ref. Weekly payout summary.
```

### Prompt 7.2: Payroll (Kenya)

```
1. Statutory rate tables in farm_settings with effective_from, never hard-coded:
   - PAYE bands and personal relief
   - SHIF rate and minimum
   - NSSF Tier I/II limits and rates
   - Affordable Housing Levy rate
   - Also: the order in which deductions reduce taxable pay, per current KRA guidance.
   Seed them with the rates in force when this phase is implemented, verified against KRA, SHA and NSSF official publications. Record each source URL in the settings row.
2. payroll.service.js:
   - generate(period) → draft payroll_run with a payslip per employee (gross from salary, or daily_rate × days attended; plus allowances).
   - Computes each statutory deduction and net pay.
   - approve → posts wages by enterprise (labour hours split from activities, else default enterprise).
   - mark-paid → mpesa refs.
3. Payslip PDF.
4. Frontend: Payroll run wizard (draft → review → approve → pay) and payslip view.
```

### Prompt 7.3: Tasks + Worker Quick-Log

```
1. Tasks:
   - Adds enterprise_id, a subject (crop_batch/animal/group/location, and hive after Phase 8), recurrence_rule (RRULE subset: daily, weekly by day, every N days), source manual|care_plan, checklist and assignments.
   - POST /tasks/:id/complete { labour_hours, notes, checklist } creates a done activity (or converts the task's planned activity to done).
   - Care plans generate tasks with planned activities.
   - GET /tasks/my, /tasks/calendar and /tasks/overdue.
2. Worker scope: the worker role sees only tasks assigned to them and quick-log endpoints. It is denied finance, payroll and settings.
3. Quick-log:
   - views/quick-log/QuickLogHome.vue (mobile-first large buttons): Log feeding, Log eggs, Log milk, Log spray, Record mortality, Complete my task.
   - Each form pre-fills its subject.
4. QR codes:
   - Each location, animal house, pen and (Phase 8) hive gets qr_code (a short random slug).
   - A printable labels page uses the qrcode library.
   - /q/:code resolves via GET /quick-log/context?qr= and opens quick-log for that subject.
5. Frontend: EmployeeList and Profile (tabs), RollCall, TaskBoard, TaskCalendar, TaskDetail.
```

### Phase 7 Tests

```javascript
describe("Payroll calculations (worked examples from current official guidance)", () => {
  it("PAYE at each band edge");
  it("SHIF with minimum contribution applied");
  it("NSSF tier I and tier II caps");
  it("Housing Levy");
  it("uses the rate set effective for the payroll period, not today's");
});
describe("Payroll run", () => {
  it("generate → approve posts wages once per enterprise split");
  it("approving twice → 409");
  it("casual logs for the period are included");
});
describe("Tasks", () => {
  it("completing a task creates a done activity with labour hours");
  it("recurring task generates next occurrence");
  it("care plan applied to a batch generates tasks");
  it("worker sees only own tasks; GET /tasks as worker is scoped");
  it("worker cannot access /payroll-runs (403)");
});
describe("Quick-log", () => {
  it("QR code resolves to subject and allowed actions");
  it("unknown QR → 404");
});
```

---

## Phase 8: Enterprise Depth: Beekeeping, Mushrooms, Greenhouse Environment

### Git Workflow for Phase 8

```bash
git checkout develop && git pull
git checkout -b feature/phase-8-enterprise-depth
```

### Prompt 8.1: Beekeeping

```
1. Tables:
   - apiaries
   - hives (hive_code, qr_code, hive_type Langstroth|KTBH|log, colony_source, established_on, status, enterprise_id)
   - hive_inspections (queen_seen, eggs_seen, brood_pattern 1-5, temperament 1-5, population_frames, honey_stores, varroa_method, varroa_count, pests_seen text[], supers_added, supers_removed, actions, next_visit_on)
   - honey_harvests (honey_kg, wax_kg, moisture_percent)
   - hive_events (requeen, split, swarm_caught, feed, merge, absconded)
2. Every record writes an activity (subject hive_id: add the hive_id column to activities).
3. Migration: convert any animal_groups whose animal type is bees into hives.
4. Alerts (consumed in Phase 9): queenless (no queen or eggs seen on 2 consecutive inspections), varroa above the threshold setting, next_visit_on overdue.
5. Frontend:
   - ApiaryList
   - HiveDetail (inspections timeline, honey per season chart)
   - HiveInspectionForm, mobile-first and linked from quick-log/QR
```

### Prompt 8.2: Mushrooms

```
1. Tables:
   - mushroom_batches (species/strain, location_id, substrate_recipe, dry_substrate_kg, treatment_method, spawn_supplier, spawn_kg, bags_count, spawn_run_start, pinning_date, status, enterprise_id)
   - mushroom_flushes (flush_no, harvest_date, fresh_kg, grade)
   - mushroom_contaminations (contaminant, bags_discarded, action_taken)
2. Computed: biological_efficiency_pct = SUM(fresh_kg) / dry_substrate_kg × 100, contamination_rate = bags_discarded / bags_count.
3. Substrate and spawn consumption deducts inventory (Phase 4 integration); flushes write activities and can feed sale_lines.
4. Frontend: MushroomBatchList, MushroomBatchDetail (stage stepper, flush table, BE gauge), FlushForm.
```

### Prompt 8.3: Greenhouse Environment + Livestock KPI Data

```
1. environment_logs(location_id, logged_at, temp_min_c, temp_max_c, rh_percent, soil_moisture, ec, ph, source manual|sensor, recorded_by).
   - POST /environment-logs/ingest authenticates with a hashed per-device API key (devices table).
2. Charts per greenhouse; out-of-range warnings based on per-crop ranges in settings.
3. Poultry daily flock sheet (eggs, mortality, feed kg): a single form writing production, death and feed records.
4. Dairy: lactation number, calving date, dry-off date on animals; needed for the Phase 9 KPIs.
```

### Phase 8 Tests

```javascript
describe("Beekeeping", () => {
  it("inspection creates an activity with hive subject");
  it("two consecutive inspections without queen/eggs raises queenless alert");
  it("honey per hive per season aggregates harvests");
  it("bee animal_groups migrate to hives without data loss");
});
describe("Mushrooms", () => {
  it("BE% = total fresh kg / dry substrate kg × 100");
  it("contamination rate computed from discarded bags");
  it("spawn usage deducts inventory");
});
describe("Environment logs", () => {
  it("ingest rejects invalid API key");
  it("ingest accepts valid key and stores source=sensor");
});
```

---

## Phase 9: Dashboard, KPIs & Notifications

### Git Workflow for Phase 9

```bash
git checkout develop && git pull
git checkout -b feature/phase-9-dashboard-notifications
```

### Prompt 9.1: KPI Catalogue & Dashboards

```
1. docs/kpis.md: for each KPI in IMPLEMENTATION_PLAN.md Phase 9, give the definition, formula, source tables, unit and default target.
2. kpi.service.js implements each KPI for (enterprise_id?, from, to). A nightly kpi_snapshots table stores the daily values for fast trends.
3. GET /dashboard is role-shaped:
   - owner: revenue/cost/margin by enterprise, KPI tiles vs target, receivables, alerts
   - manager: today's tasks, overdue, low stock, active withdrawals, hive visits due
   - worker: my tasks and quick-log shortcuts
4. Frontend:
   - Replace Dashboard.vue with role dashboards (DashboardOwner, DashboardManager, DashboardWorker).
   - KPI tiles with sparkline and target delta; enterprise filter.
```

### Prompt 9.2: Jobs, Notifications, Weather, Export

```
1. pg-boss:
   - Starts with the API process (or a separate worker via npm run worker).
   - Schedules in Africa/Nairobi: low-stock, expiring-batches, withdrawal-ending, care-plan-due, tasks-overdue, hive-visit-due, kpi-snapshot (01:00), daily-digest (06:00).
2. Notifications:
   - notifications(user_id, type, title, body, entity_type, entity_id, read_at, channels_sent) and notification_preferences(user_id, type, in_app, sms, whatsapp, email, quiet_hours).
   - Channel adapters: InApp, AfricasTalkingSms, AfricasTalkingWhatsApp (behind interfaces; mocked in tests).
   - Deduplicate by (user, type, entity, day).
   - Password-reset links go through this engine.
3. Weather:
   - Open-Meteo forecast and daily history for the farm coordinates, cached in weather_daily.
   - Shown on the dashboard, and rainfall is available in reports.
4. GET /export/:module?format=csv streams CSV using the same filters as the list endpoints.
5. Frontend: notification bell with unread count, notification centre, preferences page.
```

### Phase 9 Tests

```javascript
describe("KPIs (fixtures with known answers)", () => {
  it("hen-day % = eggs / (hens × days) × 100");
  it("FCR = feed kg / weight gain kg");
  it("milk per cow per day averages only lactating cows");
  it("yield per m² for a greenhouse batch");
  it("calving interval between consecutive calvings");
});
describe("Dashboard", () => {
  it("owner payload contains finance; worker payload does not");
});
describe("Jobs & notifications", () => {
  it("low-stock job creates one notification per item per day (dedup)");
  it("respects preferences and quiet hours");
  it("SMS adapter called with formatted message (mocked)");
  it("daily digest summarises tasks, alerts and withdrawals");
});
describe("Export", () => {
  it("CSV export honours list filters and role access");
});
```

---

## Phase 10: Production Readiness & Offline PWA

### Git Workflow for Phase 10

```bash
git checkout develop && git pull
git checkout -b feature/phase-10-production
```

### Prompt 10.1: Offline PWA

```
1. vite-plugin-pwa: app shell precache, runtime cache for reference data (items, locations, animals, groups, hives).
2. The IndexedDB outbox (idb) holds quick-log and task-completion submissions with client_request_id (uuid v4).
3. A sync worker flushes the outbox via POST /activities/bulk when online. Per-item results mark items synced or failed with a reason.
4. UI: offline banner, "N pending / last synced at" indicator, failed-items review screen.
```

### Prompt 10.2: Deployment, Backups, Security, E2E, Docs

```
1. Dockerfiles:
   - api: node:22-alpine, non-root
   - web: build, then nginx:alpine serving dist and proxying /api
   docker-compose.prod.yml with the api, web, postgres:18 and a backup sidecar. TLS via Let's Encrypt (certbot or Caddy).
2. /health (liveness) and /ready (DB + migrations applied). Structured JSON logs with rotation.
3. Backups:
   - Nightly pg_dump -Fc plus an attachments tarball; retention 7 daily / 4 weekly / 6 monthly; off-site copy.
   - scripts/restore.sh and docs/runbooks/restore.md.
   - Perform and record a restore drill.
4. Security:
   - npm audit gate, CSP headers.
   - An authz matrix test that iterates every route in the OpenAPI spec × {owner, manager, worker, anonymous} against expected access.
5. Playwright E2E:
   - login
   - spray → harvest blocked → wait/override
   - sale → partial payment → aging
   - payroll run
   - offline quick-log → reconnect → synced
6. OpenAPI complete. Generate the Dart client (openapi-generator-cli) into a separate repo or folder as the Flutter starting point.
7. Docs: user guides per role (owner, manager, worker), a Swahili quick-log guide, the admin/deploy runbook.
8. Optional: M-Pesa Daraja C2B confirmation URL for automatic payment matching.
```

### Phase 10 Tests

```javascript
// e2e/*.spec.js (Playwright)
test("owner logs in and sees owner dashboard");
test("spraying a batch blocks harvest until PHI passes; owner override works");
test("sale issued, partially paid, appears in 0-30 aging bucket");
test("payroll run from draft to paid");
test("offline quick-log entry syncs once online without duplicates");

// tests/integration/authz-matrix.test.js
describe("Authorization matrix", () => {
  it("every OpenAPI operation enforces its declared roles");
});

// ops
describe("Restore drill (manual, recorded in docs/runbooks/restore.md)", () => {
  it("restores last night's dump to a fresh DB and app boots against it");
});
```

---

## Test Summary

### Test Files Structure

```
packages/
├── backend/
│   ├── jest.config.js
│   └── tests/
│       ├── setup/
│       │   ├── env.js               # DB_NAME=farm_management_test etc.
│       │   ├── global-setup.js      # create test DB + run migrations
│       │   ├── global-teardown.js
│       │   └── after-env.js         # truncateAll, pool close
│       ├── factories/               # users, items, batches, animals, ...
│       ├── unit/
│       │   ├── repositories/base.repository.test.js
│       │   ├── config/type-parsers.test.js
│       │   ├── database/migrate.test.js
│       │   ├── utils/units.test.js
│       │   └── services/            # payroll, costing, kpi calculators
│       └── integration/
│           ├── auth.test.js
│           ├── users.test.js
│           ├── errors.test.js
│           ├── soft-delete.test.js
│           ├── crops.test.js
│           ├── animals.test.js
│           ├── inventory.test.js
│           ├── inventory.transactions.test.js
│           ├── consumption.test.js
│           ├── activities.test.js
│           ├── finance.test.js
│           ├── costing.test.js
│           ├── workforce.test.js
│           ├── payroll.test.js
│           ├── beekeeping.test.js
│           ├── mushrooms.test.js
│           ├── kpis.test.js
│           ├── notifications.test.js
│           └── authz-matrix.test.js
└── frontend/
    ├── tests/unit/
    │   ├── stores/auth.store.test.js
    │   ├── services/api.test.js
    │   ├── router/guard.test.js
    │   ├── composables/useLazyTable.test.js
    │   └── components/               # InventoryItemPicker, HarvestForm, ...
    └── e2e/                          # Playwright (Phase 10)
```

### Running Tests

```bash
# Local PostgreSQL must be running (credentials from packages/backend/.env); the test DB is created automatically
npm run test:backend                      # all backend tests
npm run test:backend -- tests/integration/auth.test.js
npm run test:backend -- -t "FEFO"         # by test name
npm run test:frontend                     # vitest
npm test                                  # both
npm run test:e2e                          # Playwright (Phase 10)
```

### Test Coverage Targets

Coverage gates are raised per phase and enforced in CI (backend lines):

| After phase | Gate | Must-have suites |
|---|---|---|
| 3.5 | 60% on touched modules | auth, base.repository, inventory transactions, errors, migrate |
| 4 | 65% | consumption, PHI/withdrawal |
| 5 | 70% | activities, audit |
| 6 | 75% | finance, costing (known-answer fixtures) |
| 7 | 75% | payroll (band edges), tasks, worker scope |
| 8–9 | 75% | enterprise calculators, KPIs, notifications |
| 10 | 80% + authz matrix + E2E | full |

---

## Quick Reference: Git Commands by Phase

```bash
# Start new phase
git checkout develop && git pull
git checkout -b feature/phase-X-name

# During development
git add <files>
git commit -m "type(scope): description"

# Ready for review
git push -u origin feature/phase-X-name
# Create PR on GitHub

# After PR approved
git checkout develop
git pull origin develop

# Final release
git checkout main
git merge develop
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags
```
