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
- **Database**: PostgreSQL
- **State Management**: Pinia
- **Authentication**: JWT with refresh tokens

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker and Docker Compose (for PostgreSQL)

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

```bash
docker-compose up -d
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
│   ├── frontend/         # Vue.js 3 application
│   └── shared/           # Shared types and constants
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

The system is being built in 9 phases over 14 weeks:

1. **Foundation** (Weeks 1-2): Project setup and authentication
2. **Crop Management** (Weeks 3-4): Crop lifecycle and pest management
3. **Animal Management** (Weeks 5-6): Animal tracking, health, and feed
4. **Inventory Management** (Week 7): Stock tracking and alerts
5. **Financial Management** (Weeks 8-9): Transactions and reports
6. **Employee Management** (Week 10): Farmworker and attendance tracking
7. **Task Management** (Week 11): Task assignment and progress tracking
8. **Dashboard & Analytics** (Week 12): KPIs and visualizations
9. **Testing & Refinement** (Weeks 13-14): Quality assurance

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed information.

## License

MIT

## Support

For issues and questions, please create an issue in the repository.
