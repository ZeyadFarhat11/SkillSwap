# SkillSwap: Architecture and Rules

> Read this file fully before every task and follow it strictly.
> Do not add features, tables, or pages that are not described here.
> If something is unclear or conflicts with this file, ask before coding.

## 1. What the app does

Users list skills they can **offer** and skills they **want** to learn. The app
suggests other users to swap with. Two users agree on a swap request, schedule
sessions inside their shared availability, hold the sessions, then rate each
other. A points balance rewards teaching and pays for one-way learning.

The UI/front end is already built by teammates as static HTML pages styled
with Tailwind (in `frontend-original/`). Our job is the back end that serves
those pages as Pug templates.

## 2. Stack

| Concern | Choice |
|---|---|
| Runtime / server | Node.js 20+, Express |
| Views | Pug (server-rendered) |
| CSS | Tailwind CLI, output to `public/css/app.css` |
| Database | MySQL 8 (via Docker Compose for local dev) |
| ORM / migrations | Prisma (`prisma/schema.prisma` is the source of truth) |
| Auth | express-session + MySQL session store, bcrypt |
| Validation | zod |
| Security | helmet, csrf-csrf, express-rate-limit |
| Uploads | multer (disk storage) + sharp + file-type |
| Flash messages | connect-flash |
| Logging | morgan |
| Dev tooling | nodemon, ESLint, Prettier |
| Tests | Jest + Supertest |
| Suggestions model | Separate Python FastAPI service in `ml-service/` |

No SPA frameworks. Small client-side scripts are plain JavaScript (or Alpine.js).

## 3. Architecture: layered MVC monolith

Request flow:

`route -> middleware -> controller -> service -> model (Prisma) -> MySQL`,
then the controller renders a Pug view or redirects.

Rules:
- **Controllers** only read the request, call a service, and respond. No SQL,
  no business rules.
- **Services** hold all business logic and never touch `req`/`res`.
- **Models** (Prisma access) are only called from services.
- Anything that changes more than one table (points, swap acceptance, session
  completion) runs inside a **single database transaction**.
- Always use Prisma or parameterized queries. Never build SQL by string
  concatenation.

## 4. Folder structure

```
skillswap/
├── docs/ARCHITECTURE.md
├── frontend-original/          # teammates' HTML (read-only reference)
├── src/
│   ├── app.js                  # express setup
│   ├── server.js               # starts the server
│   ├── config/                 # env.js, db.js, session.js, constants.js
│   ├── routes/                 # one file per area (see section 8)
│   ├── controllers/
│   ├── services/               # includes suggestionService.js, storageService.js
│   ├── models/                 # Prisma client + helpers
│   ├── middlewares/            # auth, requireRole, validate, upload, errorHandler
│   ├── validators/             # zod schemas
│   └── views/
│       ├── layouts/base.pug
│       ├── partials/
│       └── pages/
├── public/                     # css, js, static images
├── uploads/                    # user images (gitignored, outside public/)
├── ml-service/                 # FastAPI app (main.py, matcher.py, requirements.txt)
├── prisma/                     # schema.prisma, migrations, seed.js
├── tests/
├── docker-compose.yml          # mysql (+ ml-service)
├── .env.example
└── package.json
```

## 5. Database schema (from the team ERD)

All tables use `id INT AUTO_INCREMENT PRIMARY KEY` and have `created_at`
(default now) unless stated. Use ENUMs where listed. Add indexes on every
foreign key.

**users**
`name`, `email` (UNIQUE), `password_hash`, `role` ENUM(`user`,`admin`) default
`user`, `bio` TEXT NULL, `avatar_path` NULL, `status` ENUM(`active`,`suspended`)
default `active`, `points_balance` INT default 0 (never below 0).

**user_project_links** (ERD multivalued attribute *ProjectLinks*)
`user_id` FK, `url`.

**availability**
`user_id` FK, `day_of_week` (0 to 6), `start_time`, `end_time`
(end must be after start; no overlapping slots for the same user and day).

**skills**
`skill_name` (UNIQUE), `status` ENUM(`pending`,`approved`,`rejected`).
Only `approved` skills appear in lists. Seed an initial set.

**user_skills** (weak entity *User Skill*)
`user_id` FK, `skill_id` FK, `type` ENUM(`offer`,`want`), `level`
ENUM(`beginner`,`intermediate`,`advanced`).
UNIQUE(`user_id`, `skill_id`, `type`). A user cannot both offer and want the
same skill.

**swap_requests**
`sender_id` FK, `receiver_id` FK (must differ),
`wanted_skill_id` FK (skill the sender wants; receiver must offer it),
`offered_skill_id` FK **NULLABLE** (skill the sender teaches in return;
NULL means a one-way request paid with points),
`status` ENUM(`pending`,`accepted`,`declined`,`cancelled`,`completed`).

**sessions**
`swap_request_id` FK, `instructor_id` FK, `learner_id` FK, `skill_id` FK,
`date_time`, `status` ENUM(`scheduled`,`completed`,`cancelled`),
`summary` TEXT NULL.

**ratings**
`session_id` FK, `reviewer_id` FK, `reviewee_id` FK, `stars` (1 to 5),
`comment` TEXT NULL. UNIQUE(`session_id`, `reviewer_id`).

**points_transactions**
`user_id` FK, `session_id` FK NULL, `type` ENUM(`bonus`,`earn`,`spend`,
`adjustment`), `amount` INT (always positive; `type` gives the direction),
`created_at` is the ERD's *Date*.

**messages**
`sender_id` FK, `receiver_id` FK, `content` TEXT, `sent_at`.

**reports**
`submitter_id` FK, `reported_user_id` FK NULL,
`type` ENUM(`user`,`message`,`bug`,`other`), `subject`, `description` TEXT,
`status` ENUM(`open`,`in_review`,`resolved`).

Additions beyond the ERD (the team should add them to the ERD):
`users.avatar_path`, `sessions.skill_id`, `reports.reported_user_id`,
`ratings.reviewee_id`, `swap_requests.offered_skill_id` being nullable.

## 6. Business rules

**Swap requests**
- A user sends a request to another user who offers the `wanted_skill`.
- The sender cannot send to themselves, and cannot send a duplicate pending
  request for the same pair and skills.
- The receiver can accept or decline. The sender can cancel while `pending`.
- After acceptance, sessions are created: one session if the request is
  one-way, two sessions (one per direction) if it is a mutual swap.

**Sessions**
- `date_time` must fall inside **both** users' availability slots.
- Either participant can cancel a `scheduled` session.
- Either participant can mark a session `completed` once `date_time` has
  passed. When all sessions of a request are completed, the request becomes
  `completed`.

**Ratings**
- Only participants of a `completed` session can rate, once each.
  `reviewee_id` is always the other participant. Stars 1 to 5.
- A user's average rating is calculated from `ratings.reviewee_id`.

**Points** (assumed rules; the team must confirm, then keep them in
`config/constants.js` as `STARTER_POINTS` default 20 and `POINTS_PER_SESSION`
default 10)
- A new user receives `STARTER_POINTS` as a `bonus` transaction at
  registration.
- **Mutual swap** sessions move no points. Users with 0 points can use them.
- **One-way** sessions: the learner must have at least `POINTS_PER_SESSION`
  when the request is sent. When the session is marked `completed`, inside one
  transaction: lock both user rows, re-check the balance, subtract from the
  learner (`spend`), add to the instructor (`earn`), update both
  `points_balance` values, and insert both transaction rows.
- `points_balance` must always equal the sum of that user's transactions.
- Admin adjustments use type `adjustment`.

**Reports and moderation**
- Any user can submit a report. Admins list reports and change their status.
- Admins can approve or reject pending skills and suspend or reactivate users.
  Suspended users cannot log in.

## 7. Suggestions (ML service)

Endpoint: `GET {ML_SERVICE_URL}/suggest/{user_id}?limit=10`.

Response:
```json
[
  {
    "user_id": 12,
    "score": 87,
    "reasons": {
      "skill_match": 0.9,
      "level_fit": 0.7,
      "availability_overlap": 0.6,
      "rating": 0.8
    },
    "they_offer_skill_id": 4,
    "they_want_skill_id": 9
  }
]
```

How it works:
- The service reads users, `user_skills`, `availability`, and `ratings` from
  MySQL using a **read-only** database user.
- Candidate rule: the candidate offers a skill the user wants. A mutual match
  (user also offers what the candidate wants) scores higher.
- Fuzzy skill matching with sentence-transformers embeddings (cache the
  skill-name embeddings at startup).
- `score` = weighted sum scaled to 0 to 100. Default weights: skill match
  0.5, availability overlap 0.2, level fit 0.1, rating 0.2. Keep the weights
  in one config dict.
- The `reasons` object is shown to the user as the explanation of the match.

In Express, `services/suggestionService.js` calls the service with a 2 second
timeout. **On failure or timeout, fall back** to a plain SQL query returning
exact mutual skill matches, so the Suggestions page never breaks.

## 8. Routes (match page names to the HTML in `frontend-original/`)

| Area | Routes |
|---|---|
| Welcome | `GET /`, `GET /welcome` |
| Auth | `GET/POST /register`, `GET/POST /login`, `POST /logout` |
| Profile | `GET /profile`, `GET/POST /profile/edit`, `POST /profile/avatar`, `GET /users/:id` |
| Skills | `GET /skills`, `POST /skills/mine`, `POST /skills/mine/:id/delete` |
| Availability | `GET /availability`, `POST /availability`, `POST /availability/:id/delete` |
| Suggestions | `GET /suggestions` |
| Swap requests | `GET /requests`, `POST /requests`, `POST /requests/:id/accept`, `/decline`, `/cancel` |
| Sessions | `GET /sessions`, `POST /sessions`, `POST /sessions/:id/complete`, `/cancel` |
| Ratings | `GET /sessions/:id/review`, `POST /sessions/:id/rating` |
| Messages | `GET /messages`, `GET /messages/:userId`, `POST /messages` |
| Points | `GET /points` |
| Reports | `GET/POST /reports` |
| Admin | `GET /admin/reports`, `POST /admin/reports/:id/status`, `GET /admin/skills`, `POST /admin/skills/:id/approve`, `/reject`, `GET /admin/users`, `POST /admin/users/:id/suspend`, `/reactivate` |

HTML forms only use GET and POST, so state changes are POST routes.
Messages start as plain HTTP (form post + refresh or polling). Move to
Socket.IO only if the design requires live chat.

If a page in `frontend-original/` has no route here, or a route has no page,
stop and ask.

## 9. Front end integration

- Convert each HTML page in `frontend-original/` to Pug. Do **not** redesign
  or rename Tailwind classes.
- Shared head, navbar, and footer go in `views/layouts/base.pug`. Repeated UI
  (cards, form fields, flash messages) goes in `views/partials/`.
- `tailwind.config.js` content must include `./src/views/**/*.pug`.
- Scripts: `npm run dev` runs nodemon and Tailwind watch together;
  `npm run build:css` produces the minified CSS.
- Use `=` (escaped) for all user-provided values in Pug. Never use `!=` on
  user content.

## 10. Image uploads (local)

- multer disk storage into `uploads/` (gitignored, keep `uploads/.gitkeep`).
- Allow only JPEG, PNG, and WebP. Max 5 MB. Verify the real file type with
  `file-type`, not just the extension or header.
- Rename to `<uuid>.<ext>`. Resize with sharp (avatars to 400x400).
- Store only the relative file path in MySQL.
- Serve through `express.static` mounted at `/uploads`.
- All upload code goes through `services/storageService.js` so storage can
  change later.

## 11. Auth and security

- Passwords hashed with bcrypt (cost 12). Minimum password length 8.
- Sessions in cookies (httpOnly, sameSite=lax, secure in production),
  stored in MySQL.
- Middleware: `requireAuth`, `requireRole('admin')`.
- CSRF token on every state-changing form.
- Rate limit `/login`, `/register`, and `/messages`.
- Authorization checks in services: users can only edit their own data, and
  only participants can see or act on a request or session.
- Validate every body, query, and param with zod.
- Central error handler with friendly error pages; never leak stack traces.

## 12. Configuration

`.env.example` must contain: `PORT`, `NODE_ENV`, `DATABASE_URL`,
`SESSION_SECRET`, `ML_SERVICE_URL`, `UPLOAD_DIR`, `MAX_UPLOAD_MB`,
`STARTER_POINTS`, `POINTS_PER_SESSION`. Never commit `.env`.

## 13. How to work

1. Work in the phases below. Finish one phase, run its tests, and stop for
   review before starting the next.
2. After each phase, summarize what you built and any decisions you made.
3. Add Jest + Supertest tests for services and the main routes of each phase.
4. Never edit migrations that were already applied; create a new one.
5. Keep commits small: one feature per commit.

**Phases**
1. Scaffold, config, Docker Compose, Prisma schema + migrations + seed,
   base layout, Tailwind build. (Show the schema for review before migrating.)
2. Auth (register with starter points, login, logout, sessions, CSRF).
3. Profile, avatar upload, project links, skills (offer/want), availability.
4. Convert the remaining pages to Pug.
5. Swap requests and sessions (including points transactions).
6. Ratings, messages, reports, points history page.
7. `ml-service` + `suggestionService` + Suggestions page, with SQL fallback.
8. Admin pages, error pages, polish, test coverage.