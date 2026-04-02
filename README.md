# Resource Manager

A full-stack web application for managing developer resource allocation across projects on a weekly basis. Team Leads and Managers can assign developers to projects, track utilisation, and use an AI assistant (powered by FiservAI) to plan and suggest resource allocation for new projects.

---

## Project Overview

Managing who is working on what — and how much — is a constant challenge for engineering teams. Resource Manager gives Team Leads and Managers a single place to:

- **Add and manage developers** (resources) with their skills and roles
- **Define projects** with timelines and status
- **Allocate developers to projects per week** with a percentage of their time (e.g. 60% on Project A, 40% on Project B)
- **See at a glance** which developers are over- or under-utilised across any week range
- **Let AI suggest** how to staff a new project based on current availability
- **Track every change** through a full audit log showing who changed what and when

### Roles

| Role | Access |
|------|--------|
| **Team Lead** | Full access — add/edit/delete resources, projects, allocations, and users |
| **Manager** | Full access — same as Team Lead plus primary owner of the dashboard view |
| **Viewer** | Read-only — can see all data but cannot make any changes |

Passwords are hashed with bcrypt. Team Leads and Managers can reset any user's password and set a temporary one; the user is then forced to change it on their next login.

---

## Technology Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | Runtime |
| **Express** | 4.18 | REST API framework |
| **sql.js** | 1.12 | SQLite via WebAssembly — no native compilation required |
| **bcryptjs** | 2.4 | Password hashing (pure JavaScript) |
| **jsonwebtoken** | 9.0 | JWT-based authentication (8-hour tokens) |
| **dotenv** | 16.4 | Environment variable management |
| **cors** | 2.8 | Cross-origin request handling |
| **nodemon** | 3.1 | Dev auto-restart |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2 | UI framework |
| **TypeScript** | 5.2 | Type safety |
| **Vite** | 5.1 | Build tool and dev server |
| **Tailwind CSS** | 3.4 | Utility-first styling |
| **React Router** | 6.22 | Client-side routing |
| **Recharts** | 2.12 | Charts and visualisations (utilisation bar charts) |
| **Axios** | 1.6 | HTTP client for API calls |

### AI Integration

| Technology | Purpose |
|------------|---------|
| **FiservAI** (Python) | Internal AI gateway client |
| **Python 3** | Runs `ai_client.py` as a child process from Node.js |
| **asyncio** | Runs `chat_completion_async` from synchronous context |

The Node.js backend spawns `ai_client.py` for each AI planning request, passing the full resource context (availability, skills, active projects) and the user's message. The Python script calls FiservAI and returns the response as JSON.

### Database

- **SQLite** (via sql.js) stored at `backend/data/resourcemanager.db`
- No external database server required — the file is created automatically on first run
- Tables: `users`, `resources`, `projects`, `allocations`, `audit_log`

---

## Project Structure

```
ResourceManager/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── database.js            # sql.js wrapper + schema init + seed data
│   ├── ai_client.py           # Python FiservAI bridge script
│   ├── requirements.txt       # Python dependencies (fiservai)
│   ├── package.json
│   ├── .env                   # Environment variables (not committed)
│   ├── .env.example           # Template for environment variables
│   ├── middleware/
│   │   └── auth.js            # JWT authentication + role enforcement
│   ├── routes/
│   │   ├── auth.js            # Login, change-password endpoints
│   │   ├── users.js           # User management (CRUD + password reset)
│   │   ├── resources.js       # Developer resource CRUD
│   │   ├── projects.js        # Project CRUD
│   │   ├── allocations.js     # Weekly allocation CRUD + utilisation summary
│   │   ├── ai.js              # AI planner endpoint (spawns ai_client.py)
│   │   └── auditlog.js        # Audit log read endpoint
│   └── data/
│       └── resourcemanager.db # SQLite database (auto-created)
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx                    # Routes + auth guards
│       ├── main.tsx
│       ├── index.css
│       ├── api/
│       │   └── client.ts              # Axios instance + all API functions
│       ├── context/
│       │   └── AuthContext.tsx        # Auth state, login/logout, mustChangePassword
│       ├── types/
│       │   └── index.ts               # Shared TypeScript interfaces
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── Sidebar.tsx
│       │   ├── Header.tsx
│       │   └── RoleBadge.tsx
│       └── pages/
│           ├── Login.tsx              # Login page with demo account quick-fill
│           ├── ChangePassword.tsx     # Forced password change after temp password
│           ├── Dashboard.tsx          # Utilisation heatmap + stacked bar chart
│           ├── Resources.tsx          # Developer management
│           ├── Projects.tsx           # Project management
│           ├── Allocations.tsx        # Weekly allocation grid
│           ├── Users.tsx              # User management + password reset
│           ├── AuditLog.tsx           # Change history
│           └── AIPlanner.tsx          # AI chat interface
└── README.md
```

---

## Prerequisites

- **Node.js** 18 or higher — [nodejs.org](https://nodejs.org)
- **npm** 9 or higher (comes with Node.js)
- **Python 3.8+** — [python.org](https://python.org) (required for AI Planner only)
- **pip** — Python package manager

---

## Setup & Installation

### 1. Clone or download the project

```bash
cd /Users/Sandy/ResourceManager
```

### 2. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
PORT=3001
JWT_SECRET=replace_with_a_long_random_string

# Internal AI gateway (FiservAI)
INTERNAL_AI_ENDPOINT=https://your-internal-ai-endpoint/v1
INTERNAL_AI_KEY=your-api-key-here
INTERNAL_AI_SECRET=your-api-secret-here
```

> **JWT_SECRET** should be a long random string. You can generate one with:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Install backend dependencies

```bash
# In the backend/ directory
npm install
```

### 4. Install Python dependencies (for AI Planner)

```bash
pip install fiservai
# or
pip install -r requirements.txt
```

### 5. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Running the Application

Open **two terminals**.

**Terminal 1 — Backend:**
```bash
cd /Users/Sandy/ResourceManager/backend
npm start
```
The API will be available at `http://localhost:3001`

**Terminal 2 — Frontend:**
```bash
cd /Users/Sandy/ResourceManager/frontend
npm run dev
```
The app will be available at `http://localhost:5173`

Open your browser at **http://localhost:5173**

> For backend development with auto-restart on file changes, use `npm run dev` instead of `npm start`.

---

## Default Accounts

The database is seeded automatically on first run with the following accounts:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Team Lead |
| `john.manager` | `mgr123` | Manager |
| `alex.viewer` | `view123` | Viewer |

> These are for development only. Change passwords before any production use.

The login page includes a **Quick Login** panel — click any account row to auto-fill the credentials.

---

## Key Features

### Dashboard
- **Utilisation heatmap** — table of all developers × weeks, colour-coded: green (<80%), yellow (80–99%), red (≥100% overallocated)
- **Stacked bar chart** — per-developer breakdown of time across projects
- **Project breakdown cards** — who is on each project and at what percentage
- Week range navigation (previous / next)

### Allocations Grid
- 8-week scrollable grid showing total utilisation per developer per week
- Click any cell to see the project breakdown for that developer and week
- Add / edit / delete allocations (Team Lead and Manager only)

### User Management
- Create accounts with Team Lead, Manager, or Viewer roles
- Reset any user's password — sets a temporary password and forces the user to change it on next login
- Password reset pending status shown in the user list

### AI Planner
- Chat interface — describe a new project in plain English
- AI receives full context: every developer's skills and week-by-week availability for the next 8 weeks, plus all active projects
- Returns suggested allocations with resource, project, week, and percentage
- **Apply** button creates the allocation directly from the suggestion

### Audit Log
- Every create, update, and delete on allocations, resources, and projects is recorded
- Shows: timestamp, user name, role, action type, and full details (e.g. "Alice Chen → Customer Portal | Week 2024-04-07 | 50% → 70%")
- Filterable by entity type, paginated

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | Any | Current user info |
| PUT | `/api/auth/change-password` | Any | Change own password |
| GET | `/api/users` | Any | List all users |
| POST | `/api/users` | Editor | Create user |
| PUT | `/api/users/:id` | Editor | Update user |
| PUT | `/api/users/:id/reset-password` | Editor | Set temporary password |
| DELETE | `/api/users/:id` | Editor | Delete user |
| GET | `/api/resources` | Any | List developers |
| POST | `/api/resources` | Editor | Add developer |
| PUT | `/api/resources/:id` | Editor | Update developer |
| DELETE | `/api/resources/:id` | Editor | Delete developer |
| GET | `/api/projects` | Any | List projects |
| POST | `/api/projects` | Editor | Add project |
| PUT | `/api/projects/:id` | Editor | Update project |
| DELETE | `/api/projects/:id` | Editor | Delete project |
| GET | `/api/allocations` | Any | List allocations (filterable) |
| GET | `/api/allocations/summary/utilization` | Any | Weekly utilisation summary |
| POST | `/api/allocations` | Editor | Create allocation |
| PUT | `/api/allocations/:id` | Editor | Update allocation |
| DELETE | `/api/allocations/:id` | Editor | Delete allocation |
| POST | `/api/ai/plan` | Any | AI resource planning |
| GET | `/api/audit-log` | Any | Audit log (filterable) |

> **Editor** = Team Lead or Manager role. **Any** = any authenticated user.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Backend port (default: `3001`) |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `INTERNAL_AI_ENDPOINT` | Yes (AI) | Base URL of the FiservAI gateway |
| `INTERNAL_AI_KEY` | Yes (AI) | API key for the AI gateway |
| `INTERNAL_AI_SECRET` | Yes (AI) | API secret for the AI gateway |
