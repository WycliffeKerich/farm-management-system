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
- [ ] Phase 4: Inventory
- [ ] Phase 5: Financial
- [ ] Phase 6: Employee
- [ ] Phase 7: Task Management
- [ ] Phase 8: Dashboard

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] Database migrations included (if applicable)
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
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: farm_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run backend tests
        run: npm run test:backend
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/farm_test
          JWT_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run frontend tests
        run: npm run test:frontend

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint
```

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

## Phase 4: Inventory Management

### Git Workflow for Phase 4

```bash
git checkout develop && git pull
git checkout -b feature/phase-4-inventory
```

### Prompt 4.1: Inventory Backend

```
Implement inventory management backend:

1. Inventory Categories:
   - CRUD endpoints
   - Seed: Seeds, Feed, Fertilizer, Pesticide, Medicine, Equipment, Supplies

2. Inventory Items:
   - Full CRUD with item_code generation
   - Fields: name, category_id, unit, current_stock, minimum_stock,
     cost_per_unit, supplier, location, expiry_date, notes
   - Filter by category, low-stock, expiry

3. Inventory Transactions:
   - POST /api/v1/inventory/transactions
   - GET /api/v1/inventory/items/:id/transactions

   Types: purchase, usage, adjustment, return, expired, transfer
   Fields: item_id, transaction_type, quantity, unit_cost,
   reference_type (crop_batch/animal/etc), reference_id, notes

4. Stock Management:
   - GET /api/v1/inventory/low-stock
   - GET /api/v1/inventory/expiring (items expiring within 30 days)
   - Automatic stock level updates on transactions

5. Services:
   - createItem(data)
   - recordTransaction(data) - update stock levels
   - getLowStockItems()
   - getExpiringItems(days)
   - getUsageReport(itemId, dateRange)
```

### Prompt 4.2: Inventory Frontend

```
Create inventory management frontend:

1. Inventory Dashboard (src/views/inventory/InventoryDashboard.vue):
   - Total items, low stock alerts, expiring soon
   - Stock value summary
   - Recent transactions

2. Item List (src/views/inventory/ItemList.vue):
   - DataTable with category filter
   - Stock level indicators (color coded)
   - Low stock warning badges
   - Search by name or code

3. Item Form (src/views/inventory/ItemForm.vue):
   - Category dropdown
   - Item details
   - Stock levels (current, minimum)
   - Supplier info
   - Expiry date (optional)

4. Item Detail (src/views/inventory/ItemDetail.vue):
   - Item info
   - Stock level chart over time
   - Transaction history
   - Usage by department/enterprise

5. Transaction Form (component):
   - Item selection with current stock display
   - Transaction type
   - Quantity with validation (not exceeding stock for usage)
   - Reference linking (batch, animal, etc.)

6. Low Stock Alerts (component):
   - List items below minimum
   - Quick reorder action
   - Notification badge in sidebar
```

### Phase 4 Tests

```javascript
// tests/unit/services/inventory.service.test.js
describe("InventoryService", () => {
  describe("createItem", () => {
    it("should create item with generated code");
    it("should set initial stock to 0");
    it("should validate category exists");
  });

  describe("recordTransaction", () => {
    it("should increase stock for purchase");
    it("should decrease stock for usage");
    it("should not allow negative stock");
    it("should update item current_stock");
    it("should link to reference if provided");
  });

  describe("getLowStockItems", () => {
    it("should return items where current_stock < minimum_stock");
    it("should include category info");
  });

  describe("getExpiringItems", () => {
    it("should return items expiring within specified days");
    it("should order by expiry date ascending");
  });
});

// tests/integration/inventory.test.js
describe("Inventory API", () => {
  describe("POST /api/v1/inventory/items", () => {
    it("should create item");
    it("should generate unique item_code");
  });

  describe("POST /api/v1/inventory/transactions", () => {
    it("should record transaction and update stock");
    it("should return 400 for insufficient stock");
  });

  describe("GET /api/v1/inventory/low-stock", () => {
    it("should return low stock items");
  });
});
```

---

## Phase 5: Financial Management

### Git Workflow for Phase 5

```bash
git checkout develop && git pull
git checkout -b feature/phase-5-financial
```

### Prompt 5.1: Financial Backend

```
Implement financial management backend:

1. Enterprises:
   - CRUD for profit centers
   - Seed: Tomato Production, Egg Production, Milk Production, Honey, etc.

2. Transaction Categories:
   - CRUD with type (income/expense)
   - Seed: Sales, Wages, Feed Costs, Fertilizer, Medicine, Equipment, etc.

3. Financial Transactions:
   - Full CRUD
   - Fields: transaction_date, type (income/expense), category_id,
     enterprise_id, amount, payment_method, reference_number,
     description, receipt_url, recorded_by
   - Filter by: date range, type, enterprise, category

4. Sales:
   - Full CRUD
   - Fields: sale_date, enterprise_id, item_description, quantity,
     unit_price, total_amount, customer_name, customer_phone,
     payment_status (paid/partial/pending), payment_method, notes
   - Auto-create income transaction on sale

5. Reports:
   - GET /api/v1/financial/summary?start_date&end_date
   - GET /api/v1/financial/profit-loss?enterprise_id&period
   - GET /api/v1/financial/cash-flow?period
   - GET /api/v1/enterprises/:id/performance

6. Services:
   - recordTransaction(data)
   - recordSale(data) - create sale + transaction
   - getFinancialSummary(dateRange)
   - getProfitLossByEnterprise(enterpriseId, period)
   - getCashFlow(period)
```

### Prompt 5.2: Financial Frontend

```
Create financial management frontend:

1. Financial Dashboard (src/views/financial/FinancialDashboard.vue):
   - KPIs: Total income, expenses, net profit
   - Income vs expense chart (monthly)
   - Top performing enterprises
   - Recent transactions

2. Transaction List (src/views/financial/TransactionList.vue):
   - DataTable with filters
   - Income/expense toggle
   - Date range picker
   - Export to CSV

3. Transaction Form (src/views/financial/TransactionForm.vue):
   - Type selection (income/expense)
   - Category dropdown
   - Enterprise linking
   - Amount with currency
   - Payment method
   - Receipt upload

4. Sales Management (src/views/financial/SalesList.vue):
   - Sales records table
   - Payment status badges
   - Quick record payment action
   - Customer search

5. Sales Form (src/views/financial/SalesForm.vue):
   - Enterprise selection
   - Item details
   - Quantity and pricing
   - Customer info
   - Payment status

6. Reports (src/views/financial/Reports.vue):
   - Profit/Loss report with date range
   - Enterprise comparison chart
   - Cash flow visualization
   - Print/export options

Use Chart.js for visualizations. Include date range selectors.
```

### Phase 5 Tests

```javascript
// tests/unit/services/financial.service.test.js
describe("FinancialService", () => {
  describe("recordTransaction", () => {
    it("should create transaction");
    it("should validate category matches type");
    it("should validate enterprise exists");
  });

  describe("recordSale", () => {
    it("should create sale record");
    it("should auto-create income transaction");
    it("should calculate total_amount");
  });

  describe("getFinancialSummary", () => {
    it("should return totals for date range");
    it("should calculate net profit");
    it("should group by category");
  });

  describe("getProfitLossByEnterprise", () => {
    it("should return income and expenses");
    it("should calculate profit margin");
  });
});
```

---

## Phase 6: Employee Management

### Git Workflow for Phase 6

```bash
git checkout develop && git pull
git checkout -b feature/phase-6-employee
```

### Prompt 6.1: Employee Backend

```
Implement employee management backend:

1. Employees:
   - Full CRUD with employee_code generation
   - Fields per implementation plan
   - Employment types: permanent, casual, seasonal
   - Salary types: monthly, daily, hourly
   - Status: active, on_leave, terminated
   - Link to users table for system access

2. Attendance:
   - POST /api/v1/employees/:id/attendance (clock in/out)
   - GET /api/v1/employees/:id/attendance
   - PUT /api/v1/attendance/:id
   - Auto-calculate hours_worked
   - Status: present, absent, late, half_day

3. Salary Processing:
   - POST /api/v1/employee-salaries
   - GET /api/v1/employees/:id/salaries
   - GET /api/v1/employee-salaries (list all)
   - Calculate: basic_pay based on attendance and salary_type
   - Handle allowances and deductions
   - Payment status: pending, paid

4. Leave Management:
   - POST /api/v1/employee-leaves
   - GET /api/v1/employees/:id/leaves
   - PUT /api/v1/employee-leaves/:id (approve/reject)
   - Types: annual, sick, unpaid
   - Auto-calculate days_count
   - Status: pending, approved, rejected

5. Services:
   - registerEmployee(data)
   - clockIn(employeeId)
   - clockOut(employeeId)
   - calculateSalary(employeeId, period)
   - processSalaryPayment(salaryId, paymentData)
   - submitLeaveRequest(employeeId, data)
   - approveLeave(leaveId, approverId)
```

### Prompt 6.2: Employee Frontend

```
Create employee management frontend:

1. Employee Dashboard (src/views/employees/EmployeeDashboard.vue):
   - Total employees by status
   - Today's attendance summary
   - Pending leave requests
   - Upcoming salary payments

2. Employee List (src/views/employees/EmployeeList.vue):
   - DataTable with filters (department, status, type)
   - Quick view panel
   - Status badges

3. Employee Form (src/views/employees/EmployeeForm.vue):
   - Personal info section
   - Employment details section
   - Bank details section
   - Emergency contact section
   - System access checkbox (creates user)

4. Employee Profile (src/views/employees/EmployeeProfile.vue):
   - Profile info with photo
   - Tabs: Attendance, Salary, Leave, Tasks
   - Employment history
   - Performance summary

5. Attendance Management (src/views/employees/Attendance.vue):
   - Calendar view with attendance status
   - Clock in/out buttons
   - Monthly summary table
   - Edit attendance dialog

6. Salary Processing (src/views/employees/Salary.vue):
   - Generate salary for period
   - Review and adjust (allowances, deductions)
   - Bulk payment processing
   - Payment history

7. Leave Management (src/views/employees/Leave.vue):
   - Request form
   - Manager approval queue
   - Leave balance display
   - Calendar with leave periods
```

### Phase 6 Tests

```javascript
// tests/unit/services/employee.service.test.js
describe("EmployeeService", () => {
  describe("registerEmployee", () => {
    it("should create employee with generated code");
    it("should create user if system access requested");
    it("should validate unique id_number");
  });

  describe("clockIn", () => {
    it("should create attendance record");
    it("should not allow double clock in");
    it("should set late status if after 9am");
  });

  describe("clockOut", () => {
    it("should update attendance record");
    it("should calculate hours_worked");
    it("should throw error if not clocked in");
  });

  describe("calculateSalary", () => {
    it("should calculate based on monthly salary");
    it("should calculate based on daily rate and days worked");
    it("should calculate based on hourly rate and hours worked");
    it("should apply deductions for unpaid leave");
  });

  describe("submitLeaveRequest", () => {
    it("should create leave request");
    it("should validate date range");
    it("should calculate days_count");
  });

  describe("approveLeave", () => {
    it("should update status to approved");
    it("should set approver and approval date");
    it("should create attendance records for leave period");
  });
});
```

---

## Phase 7: Task Management

### Git Workflow for Phase 7

```bash
git checkout develop && git pull
git checkout -b feature/phase-7-task-management
```

### Prompt 7.1: Task Backend

```
Implement task management backend:

1. Task Categories:
   - CRUD endpoints
   - Seed: Planting, Harvesting, Feeding, Milking, Cleaning,
     Maintenance, Treatment, Administrative

2. Tasks:
   - Full CRUD with task_code generation
   - Fields per implementation plan
   - Priority: low, medium, high, urgent
   - Status: pending, in_progress, completed, cancelled
   - Link to location and enterprise

3. Task Assignments:
   - POST /api/v1/tasks/:id/assign
   - DELETE /api/v1/task-assignments/:id
   - GET /api/v1/employees/:id/tasks
   - Roles: assignee, supervisor

4. Task Updates:
   - POST /api/v1/tasks/:id/updates
   - GET /api/v1/tasks/:id/updates
   - Progress tracking with percentage
   - Hours worked logging

5. Task Checklist:
   - POST /api/v1/tasks/:id/checklist
   - PUT /api/v1/checklist-items/:id
   - Toggle completion

6. Views & Queries:
   - GET /api/v1/tasks/calendar?start&end
   - GET /api/v1/tasks/overdue
   - GET /api/v1/tasks/my-tasks (current user)

7. Services:
   - createTask(data)
   - assignTask(taskId, employeeId, role)
   - updateTaskProgress(taskId, progressData)
   - completeTask(taskId)
   - getTasksForCalendar(dateRange)
   - getOverdueTasks()
```

### Prompt 7.2: Task Frontend

```
Create task management frontend:

1. Task Dashboard (src/views/tasks/TaskDashboard.vue):
   - KPIs: pending, in progress, overdue, completed today
   - My tasks widget
   - Overdue alerts
   - Quick add task

2. Task List (src/views/tasks/TaskList.vue):
   - DataTable with rich filters
   - Priority badges with colors
   - Status column with dropdown update
   - Assignee avatars
   - Due date highlighting (overdue in red)

3. Task Form (src/views/tasks/TaskForm.vue):
   - Title and description
   - Category and priority
   - Due date and start date
   - Location and enterprise linking
   - Initial checklist items
   - Estimated hours

4. Task Detail (src/views/tasks/TaskDetail.vue):
   - Task header with status and priority
   - Description panel
   - Assignees section with add/remove
   - Checklist with progress bar
   - Updates timeline
   - Action buttons (start, complete, cancel)

5. Task Calendar (src/views/tasks/TaskCalendar.vue):
   - FullCalendar or PrimeVue Schedule
   - Color by priority
   - Click to view/edit
   - Drag to reschedule

6. My Tasks (src/views/tasks/MyTasks.vue):
   - Employee's assigned tasks
   - Filter by status
   - Quick update progress
   - Clock hours worked

7. Components:
   - TaskAssignDialog
   - TaskUpdateForm
   - ChecklistItem (with completion toggle)
```

### Phase 7 Tests

```javascript
// tests/unit/services/task.service.test.js
describe("TaskService", () => {
  describe("createTask", () => {
    it("should create task with generated code");
    it("should validate category exists");
    it("should set initial status to pending");
  });

  describe("assignTask", () => {
    it("should create assignment");
    it("should validate employee exists");
    it("should not duplicate assignments");
  });

  describe("updateTaskProgress", () => {
    it("should create update record");
    it("should update task status");
    it("should accumulate hours_worked");
  });

  describe("completeTask", () => {
    it("should set status to completed");
    it("should set completion_date");
    it("should calculate actual_hours");
  });

  describe("getOverdueTasks", () => {
    it("should return tasks past due_date");
    it("should exclude completed tasks");
    it("should order by due_date");
  });
});
```

---

## Phase 8: Dashboard & Analytics

### Git Workflow for Phase 8

```bash
git checkout develop && git pull
git checkout -b feature/phase-8-dashboard
```

### Prompt 8.1: Analytics Backend

```
Implement dashboard and analytics backend:

1. Dashboard Summary:
   - GET /api/v1/dashboard
   - Returns: active crop batches, animals, low stock count,
     pending tasks, today's production, week's revenue

2. Crop Analytics:
   - GET /api/v1/analytics/crops
   - Yield trends by crop type
   - Input costs per batch
   - Pest/disease frequency
   - Harvest comparisons

3. Animal Analytics:
   - GET /api/v1/analytics/animals
   - Production trends (eggs, milk, honey)
   - Feed consumption and costs
   - Health incident rates
   - Mortality rates

4. Financial Analytics:
   - GET /api/v1/analytics/financial
   - Revenue trends
   - Expense breakdown
   - Enterprise profitability
   - Cash flow projections

5. Employee Analytics:
   - GET /api/v1/analytics/employees
   - Attendance rates
   - Task completion rates
   - Overtime analysis
   - Payroll summaries

6. Data Export:
   - GET /api/v1/export/:module?format=csv
   - Modules: crops, animals, inventory, financial, employees, tasks

7. Services:
   - getDashboardSummary()
   - getCropAnalytics(dateRange)
   - getAnimalAnalytics(dateRange)
   - getFinancialAnalytics(dateRange)
   - exportData(module, format, filters)

Optimize queries with proper indexes and materialized views where needed.
```

### Prompt 8.2: Dashboard Frontend

```
Create comprehensive dashboard frontend:

1. Main Dashboard (src/views/dashboard/Dashboard.vue):
   - KPI cards row: revenue, expenses, profit, tasks completed
   - Production summary cards (crops, animals)
   - Charts: revenue trend, task completion, production
   - Recent activity feed
   - Quick action buttons

2. Crop Analytics (src/views/dashboard/CropAnalytics.vue):
   - Yield comparison chart
   - Input cost analysis
   - Pest/disease heatmap by month
   - Batch performance table
   - Print report button

3. Animal Analytics (src/views/dashboard/AnimalAnalytics.vue):
   - Production charts by type
   - Feed cost trends
   - Health metrics
   - Group performance comparison

4. Financial Analytics (src/views/dashboard/FinancialAnalytics.vue):
   - Revenue vs expenses line chart
   - Expense breakdown pie chart
   - Enterprise comparison bar chart
   - Monthly profit trend
   - Cash flow statement

5. Employee Analytics (src/views/dashboard/EmployeeAnalytics.vue):
   - Attendance chart
   - Task completion by employee
   - Payroll summary
   - Leave utilization

6. Report Generator (src/views/reports/ReportGenerator.vue):
   - Module selection
   - Date range picker
   - Filter options
   - Preview and export (PDF, CSV)

Use Chart.js with vue-chartjs. Include date range selectors.
Add print-friendly CSS for reports.
```

### Phase 8 Tests

```javascript
// tests/unit/services/analytics.service.test.js
describe("AnalyticsService", () => {
  describe("getDashboardSummary", () => {
    it("should return all summary metrics");
    it("should calculate correct totals");
    it("should handle empty data gracefully");
  });

  describe("getCropAnalytics", () => {
    it("should return yield data by crop type");
    it("should filter by date range");
    it("should include input cost analysis");
  });

  describe("getFinancialAnalytics", () => {
    it("should calculate revenue trends");
    it("should group expenses by category");
    it("should calculate profit margins");
  });

  describe("exportData", () => {
    it("should generate CSV format");
    it("should apply filters correctly");
    it("should handle large datasets");
  });
});
```

---

## Phase 9: Testing & Refinement

### Git Workflow for Phase 9

```bash
git checkout develop && git pull
git checkout -b feature/phase-9-testing

# After all tests pass and refinements complete:
git checkout main
git merge develop
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin main --tags
```

### Prompt 9.1: Integration Tests

```
Write comprehensive integration tests:

1. Authentication Flow:
   - Full login → access protected route → refresh → logout flow
   - Token expiration handling
   - Role-based access for all endpoints

2. Crop Lifecycle:
   - Create batch → add observations → record inputs →
     report pest → record harvest → complete batch
   - Verify all related records are created

3. Animal Management Flow:
   - Register animal → record health → record feeding →
     diagnose disease → treat → record production

4. Inventory Flow:
   - Create item → purchase transaction → usage from crop/animal →
     verify stock levels → low stock alert

5. Financial Flow:
   - Record sale → auto-create transaction →
     generate profit/loss report → verify calculations

6. Employee Workflow:
   - Register → clock in/out → request leave → approve →
     calculate salary → process payment

7. Task Workflow:
   - Create task → assign → start → update progress →
     complete checklist → mark complete

Use Supertest for API tests. Set up test database with migrations.
Clean database between test suites.
```

### Prompt 9.2: E2E Tests

```
Write end-to-end tests with Playwright:

1. Authentication:
   - Login with valid credentials
   - Login failure handling
   - Logout and session clear

2. Crop Management:
   - Navigate to crops
   - Create new batch
   - View batch details
   - Record harvest
   - Report pest incident

3. Animal Management:
   - View animal list
   - Register new animal
   - Record health event
   - Record production

4. Dashboard:
   - Verify KPIs load
   - Chart interactions
   - Date range filter
   - Export functionality

Focus on critical user flows. Include visual regression tests
for key pages if possible.
```

### Prompt 9.3: Documentation

```
Create comprehensive documentation:

1. API Documentation:
   - Generate OpenAPI/Swagger spec
   - Include request/response examples
   - Document authentication
   - List all endpoints with parameters

2. User Guide:
   - Getting started
   - Module walkthroughs with screenshots
   - Common workflows
   - FAQ section

3. Developer Guide:
   - Local setup instructions
   - Architecture overview
   - Coding standards
   - Contributing guidelines

4. Deployment Guide:
   - Production requirements
   - Environment configuration
   - Database setup
   - SSL/security checklist
   - Backup procedures

Create in Markdown format. Include diagrams where helpful.
```

---

## Test Summary

### Test Files Structure

```
packages/
├── backend/
│   └── tests/
│       ├── unit/
│       │   ├── services/
│       │   │   ├── auth.service.test.js
│       │   │   ├── crop.service.test.js
│       │   │   ├── animal.service.test.js
│       │   │   ├── inventory.service.test.js
│       │   │   ├── financial.service.test.js
│       │   │   ├── employee.service.test.js
│       │   │   ├── task.service.test.js
│       │   │   └── analytics.service.test.js
│       │   ├── repositories/
│       │   │   └── base.repository.test.js
│       │   └── middleware/
│       │       └── auth.middleware.test.js
│       ├── integration/
│       │   ├── auth.test.js
│       │   ├── crops.test.js
│       │   ├── animals.test.js
│       │   ├── inventory.test.js
│       │   ├── financial.test.js
│       │   ├── employees.test.js
│       │   └── tasks.test.js
│       └── setup.js
├── frontend/
│   └── tests/
│       ├── unit/
│       │   ├── stores/
│       │   │   └── auth.store.test.js
│       │   ├── services/
│       │   │   └── api.test.js
│       │   └── views/
│       │       ├── BatchForm.test.js
│       │       └── BatchDetail.test.js
│       └── e2e/
│           ├── auth.spec.js
│           ├── crops.spec.js
│           └── dashboard.spec.js
```

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run specific test file
npm test -- --grep "AuthService"
```

### Test Coverage Targets

| Module    | Unit Tests | Integration Tests | Target Coverage |
| --------- | ---------- | ----------------- | --------------- |
| Auth      | 90%        | 85%               | 85%             |
| Crops     | 80%        | 75%               | 75%             |
| Animals   | 80%        | 75%               | 75%             |
| Inventory | 80%        | 75%               | 75%             |
| Financial | 85%        | 80%               | 80%             |
| Employees | 85%        | 80%               | 80%             |
| Tasks     | 80%        | 75%               | 75%             |
| Analytics | 70%        | 65%               | 70%             |

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
