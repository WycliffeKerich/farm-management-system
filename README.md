# Farm Management System

A comprehensive farm management system for smallholder farms, built with Node.js, Express, Vue.js 3, and PostgreSQL.

## Features

- **Crop Management**: Track planting, growth, harvests, input applications, and pest/disease management
- **Animal Management**: Monitor individual animals and groups, health records, feed, diseases, and production
- **Inventory Management**: Stock tracking with low-stock alerts
- **Financial Management**: Transaction tracking, sales records, and profit/loss reports by enterprise
- **Employee Management**: Farmworker tracking, attendance, salaries, and leave management
- **Task Management**: Create and assign tasks with progress tracking
- **Dashboard & Analytics**: Comprehensive insights across all farm operations

## Tech Stack

- **Backend**: Node.js + Express (JavaScript ES6+)
- **Frontend**: Vue.js 3 + PrimeVue Sakai theme
- **Database**: PostgreSQL 18
- **State Management**: Pinia
- **Authentication**: JWT with refresh tokens

## Prerequisites

- Node.js 22 LTS (via [nvm](https://github.com/nvm-sh/nvm))
- npm >= 10
- PostgreSQL 18, installed locally (or Docker Compose, using the bundled `docker-compose.yml`)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd Farm_Management_System
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start PostgreSQL database

Use a local PostgreSQL 18 server with a role that has `CREATEDB`, since the test suite creates `farm_management_test` itself. Or start the containerised version:

```bash
docker compose up -d
```

### 4. Set up environment variables

Create `.env` files in both `packages/backend` and `packages/frontend` based on the `.env.example` files.

### 5. Run database migrations

```bash
cd packages/backend
npm run migrate
npm run seed
```

### 6. Start development servers

From the root directory:

```bash
npm run dev
```

This will start both the backend and frontend servers concurrently.

### 7. Access the application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/v1
- pgAdmin: http://localhost:5050 (admin@farm.local / admin)

## Project Structure

```
Farm_Management_System/
├── packages/
│   ├── backend/          # Express API server
│   └── frontend/         # Vue.js 3 application
├── docker-compose.yml    # PostgreSQL + pgAdmin setup
├── IMPLEMENTATION_PLAN.md # Detailed implementation plan
└── README.md
```

## Development

- `npm run dev` - Start both backend and frontend in development mode
- `npm run dev:backend` - Start only backend server
- `npm run dev:frontend` - Start only frontend server
- `npm run build` - Build both backend and frontend for production
- `npm run test` - Run tests for both packages
- `npm run lint` - Run ESLint on both packages

## Database Management

Access pgAdmin at http://localhost:5050 to manage the PostgreSQL database:

1. Login with: admin@farm.local / admin
2. Add server connection:
   - Host: postgres
   - Port: 5432
   - Database: farm_management
   - Username: farm_admin
   - Password: farm_password_dev

## Implementation Phases

Roadmap revised on 2026-09-29: harden first, test always, and integrate the modules through a single activity and cost model.

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: monorepo, API, auth, UI shell | ✅ Done |
| 2 | Crop Management | ✅ Done |
| 3 | Animal Management | ✅ Done |
| **3.5** | **Hardening & test harness**: auth fixes, SQL safety, transactions, typed errors, soft deletes, versioned migrations, Jest/Vitest, CI | ⏭ Next (1.5 wk) |
| 4 | Inventory completion: stock deduction from crop inputs, feed and treatments; PHI and withdrawal enforcement; suppliers | 🟡 WIP (1.5 wk) |
| 5 | Activity model and platform: farm timeline, enterprises, audit log, attachments, settings, OpenAPI | 1.5 wk |
| 6 | Finance and enterprise costing: sales, invoices, receivables, M-Pesa refs, cost of production, P&L | 2 wk |
| 7 | Workforce: employees, attendance, Kenyan payroll, tasks, worker quick-log with QR codes | 2.5 wk |
| 8 | Enterprise depth: beekeeping, mushrooms, greenhouse environment logs | 2 wk |
| 9 | Dashboard, KPIs, notifications (SMS/WhatsApp), weather | 2 wk |
| 10 | Production readiness: offline PWA, backups, deployment, E2E, security review | 3 wk |

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the details, current status and Definition of Done, and [PROMPTS_AND_TESTS.md](./PROMPTS_AND_TESTS.md) for the per-phase prompts and test specs.

## License

MIT

## Support

For issues and questions, please create an issue in the repository.
