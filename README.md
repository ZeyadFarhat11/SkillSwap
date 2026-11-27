# SkillSwap

SkillSwap is a server-rendered peer-to-peer skill exchange platform built with Node.js, Express, Pug, Tailwind CSS, Prisma, MySQL 8, and Socket.IO. Users list skills they can **offer** and skills they **want** to learn, send swap requests, schedule learning sessions within shared availability, earn and spend points on one-way sessions, message in real time, leave ratings, and manage platform activity through an admin dashboard.

---

## Key Features

- **Authentication & Sessions**: Registration (`STARTER_POINTS` bonus, default `20`), login/logout, optional email verification flow (`/verify-email`), bcrypt password hashing (cost `12`), MySQL-backed `express-session`, CSRF protection (`csrf-csrf`), Helmet security headers, and rate limiting on `/login`, `/register`, and `/messages`.
- **Profiles & Portfolio**: Editable bio, 400×400 resized avatar uploads (`JPEG`/`PNG`/`WebP` via `multer` + `file-type` + `sharp`), project links, dynamically derived badges and certificates, and public peer profile views (`/users/:id`).
- **Skills & Availability**: Manage approved `offer` and `want` skill entries and non-overlapping weekly availability slots (`/skills`, `/availability`).
- **Swap Requests & Sessions**: Mutual swaps (no points transferred) and one-way point-backed swaps (`POINTS_PER_SESSION`, default `10`), searchable peer/request lists (`/requests`), shared-availability session scheduling (`/sessions`), and atomic transactional completion & points transfer.
- **Ratings, Chat, Notifications & Points**: Session reviews (`1–5` stars), real-time Socket.IO chat with HTTP fallback and live online presence (`/messages`), unified activity notifications with an unread badge (`/notifications`), points transaction history (`/points`), and issue reporting (`/reports`).
- **Admin Panel**: Role-protected admin workspace (`/admin/users`, `/admin/skills`, `/admin/sessions`, `/admin/settings`, `/admin/reports`) featuring searchable tables, user suspension/reactivation, signed points adjustments (`POST /admin/users/:id/points-adjustment`), adding/moderating/removing skills, read-only session monitoring, and configurable platform identity and preferences (registration toggle, email verification requirement, maintenance mode).

> **Note:** Phase 7 (`ml-service` FastAPI matcher) is currently deferred/optional (`docker-compose.yml` keeps it commented out).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime & Server | Node.js 20+, Express |
| Architecture | Layered MVC (`route -> middleware -> controller -> service -> model -> MySQL`) |
| Views & Styling | Pug templates, Tailwind CSS CLI (`public/css/app.css`), plain JS (`public/js/`) |
| Database & ORM | MySQL 8, Prisma (`prisma/schema.prisma`) |
| Real-Time & Uploads | Socket.IO, Multer + `file-type` + Sharp |
| Validation & Security | Zod, Helmet, `csrf-csrf`, `express-rate-limit`, bcrypt |
| Testing & Tooling | Jest, Supertest, ESLint, Prettier |

---

## Project Structure

```text
SkillSwap/
├── docs/
│   ├── ARCHITECTURE.md      # System design, schema, and business rules
│   └── PROGRESS.md          # Phase-by-phase build log and decisions
├── frontend-original/       # Static HTML reference mockups
├── prisma/
│   ├── migrations/          # Prisma SQL migrations
│   ├── schema.prisma        # Database schema source of truth
│   ├── seed.js              # Base seed (20 skills + admin user)
│   └── seedDemo.js          # Demo dataset seed (5 interacting sample users)
├── public/
│   ├── css/app.css          # Compiled Tailwind stylesheet
│   └── js/                  # Client scripts (auth, profile, chat, notifications, adminSearch)
├── src/
│   ├── config/              # Env validation, MySQL pool, session & constants
│   ├── controllers/         # Thin HTTP request/response handlers
│   ├── middlewares/         # Auth, roles, CSRF, uploads, rate limits, settings, errors
│   ├── models/              # Prisma queries & transactions
│   ├── routes/              # Express routers
│   ├── services/            # Business logic
│   ├── sockets/             # Socket.IO chat & presence
│   ├── styles/tailwind.css  # Tailwind source CSS
│   ├── utils/               # AppError and UTC time helpers
│   ├── validators/          # Zod schemas
│   └── views/               # Pug layouts, partials, and pages
├── tests/                   # Jest + Supertest test suites
├── uploads/                 # Local avatar uploads directory (gitignored)
└── docker-compose.yml       # Local MySQL 8 service definition
```

---

## Setup Instructions

### 1. Prerequisites

- **Node.js 20+** and **npm**
- **Docker** and **Docker Compose** (for MySQL 8), or a local MySQL 8 instance

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="mysql://skillswap:skillswap@localhost:3306/skillswap"
SESSION_SECRET="replace-with-a-long-random-secret"
ML_SERVICE_URL="http://localhost:8000"
UPLOAD_DIR="uploads"
MAX_UPLOAD_MB=5
STARTER_POINTS=20
POINTS_PER_SESSION=10
SEED_ADMIN_PASSWORD="replace-with-strong-admin-password"
```

- `SESSION_SECRET` must be at least **12 characters**.
- `SEED_ADMIN_PASSWORD` must be at least **8 characters** when running the database seed.

### 4. Start MySQL (Docker Compose)

```bash
docker compose up -d mysql
```

Wait until the `skillswap-mysql` container reports healthy (`docker compose ps`).

### 5. Run Prisma Migrations & Generate Client

```bash
npx prisma migrate deploy
npm run prisma:generate
```

*(If creating or modifying migrations during development, use `npm run prisma:migrate`.)*

### 6. Seed the Database

Seed the 20 initial approved skills and the administrator account (`admin@skillswap.local` using `SEED_ADMIN_PASSWORD` from `.env`):

```bash
npm run prisma:seed
```

*(Optional)* Seed 5 sample users (`salma`, `omar`, `nour`, `karim`, `maya` `@skillswap.local`, password `Password123!`) with pre-populated swap requests, sessions, messages, ratings, and reports for testing:

```bash
npm run prisma:seed:demo
```

### 7. Build CSS & Start the Server

Build the Tailwind stylesheet and run the development server:

```bash
npm run build:css
npm run dev
```

For production/non-watch mode:

```bash
npm run build:css
npm start
```

Open **`http://localhost:3000`** in your browser.

- **Admin Login:** `admin@skillswap.local` with the `SEED_ADMIN_PASSWORD` configured in `.env`, then visit **`/admin/users`**.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run `nodemon` server + Tailwind CSS watcher concurrently |
| `npm start` | Start the Express + Socket.IO server (`src/server.js`) |
| `npm run build:css` | Compile minified CSS (`public/css/app.css`) |
| `npm test` | Run Jest + Supertest test suite (`--runInBand`) |
| `npm run lint` | Run ESLint across `src/`, `prisma/`, and `tests/` |
| `npm run format` | Format JS files with Prettier |
| `npm run prisma:validate` | Validate `prisma/schema.prisma` |
| `npm run prisma:migrate` | Run `prisma migrate dev` |
| `npm run prisma:generate` | Regenerate Prisma Client |
| `npm run prisma:seed` | Run `prisma/seed.js` (initial skills + admin account) |
| `npm run prisma:seed:demo` | Run `prisma/seedDemo.js` (5 interacting demo accounts) |

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Layered MVC rules, database schema, business rules, and route inventory
- [docs/PROGRESS.md](docs/PROGRESS.md) — Implementation progress and architectural decisions
