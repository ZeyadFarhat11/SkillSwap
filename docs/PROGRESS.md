# SkillSwap Progress

> Update this file at the end of every phase and every time a decision is made that is not in [docs/ARCHITECTURE.md](ARCHITECTURE.md).

## Done

- **Phase 1 (Scaffold, config, Docker Compose, Prisma schema + migrations + seed, base layout, Tailwind build)** — files created and validated:
  - Project config & tooling: `package.json`, `.env.example`, `.gitignore`, `.prettierrc`, `eslint.config.js`, `tailwind.config.js`, `docker-compose.yml`, `uploads/.gitkeep`, `public/images/.gitkeep`, `public/js/.gitkeep`.
  - App config & DB client: `src/config/env.js`, `src/config/db.js`, `src/config/session.js`, `src/config/constants.js`, `src/models/prisma.js`.
  - Database schema & seed: `prisma/schema.prisma`, `prisma/migrations/20261125195500_init/migration.sql`, `prisma/seed.js` (20 initial approved skills + admin user).
  - Express app & base views: `src/app.js`, `src/server.js`, `src/middlewares/errorHandler.js`, `src/views/layouts/base.pug`, `src/views/partials/{navbar,footer,flash}.pug`, `src/views/pages/{home,error}.pug`.
  - Styling: `src/styles/tailwind.css` compiled to `public/css/app.css`.
  - Tests & checks: `tests/config.test.js`, `tests/app.test.js`, `npm run lint`, `npx prisma validate`.

- **Phase 2 (Auth: register, login, logout, sessions, CSRF, rate limits, middleware, Pug pages)** — implemented and tested:
  - Validation, model, service, controller, routes:
    - `src/utils/AppError.js`, `src/validators/authValidator.js` (`registerSchema`, `loginSchema`), `src/models/userModel.js` (`createUserWithStarterPoints` using `prisma.$transaction`), `src/services/authService.js` (`registerUser`, `loginUser`, `sanitizeUser`), `src/controllers/authController.js`, `src/routes/authRoutes.js`.
  - Middlewares & app wiring:
    - `src/middlewares/csrf.js` (`csrfProtection`, `attachCsrfToken`, `rotateCsrfToken` via `csrf-csrf`), `src/middlewares/rateLimiter.js` (`loginLimiter`, `registerLimiter`, `createRateLimiter` via `express-rate-limit`), `src/middlewares/auth.js` (`requireAuth`, `requireRole`), `src/middlewares/validate.js` (`validate`), updated `src/middlewares/errorHandler.js` and `src/app.js`.
  - Views & assets:
    - Converted `frontend-original/begin/login.html` -> `src/views/pages/login.pug` and `frontend-original/begin/signup.html` -> `src/views/pages/register.pug` with flash alerts and `_csrf` hidden inputs.
    - Added `public/js/auth.js`, updated `src/styles/tailwind.css`, rebuilt `public/css/app.css`.
  - Tests & checks: `tests/auth.test.js` passing.

- **Phase 3 (Profile, avatar upload, project links, offer/want skills, availability)** — implemented and tested:
  - Utilities & validators:
    - `src/utils/time.js` (`formatPrismaTime`, `timeToMinutes`, `timeStringToPrismaDate`, `DAY_NAMES`), `src/validators/{profileValidator,skillValidator,availabilityValidator}.js`.
  - Models & services:
    - Updated `src/models/userModel.js` (`findProfileById`, `updateProfileAndLinks` in `prisma.$transaction`, `updateAvatarPath`); added `src/models/skillModel.js` and `src/models/availabilityModel.js`.
    - Added `src/services/storageService.js` (magic-byte check via `file-type`, `<uuid>.<ext>` naming, `sharp` 400x400 resize, temp/old file cleanup), `src/services/profileService.js`, `src/services/skillService.js` (approved-only, no same skill as both `offer` and `want`, ownership checks), and `src/services/availabilityService.js` (end after start, no same-day overlaps, `HH:mm` formatting, ownership checks).
  - Upload middleware, controllers, & routes:
    - `src/middlewares/upload.js` (`multer` 5 MB disk storage + `verifyMultipartCsrf`), updated `src/middlewares/{csrf,validate}.js`, added `src/controllers/{profileController,skillController,availabilityController}.js`, `src/routes/{profileRoutes,skillRoutes,availabilityRoutes}.js`, mounted in `src/app.js`.
  - Views & assets:
    - Converted matching pages to Pug: `src/views/pages/{profile,profileEdit,skills,availability}.pug`, updated `src/views/partials/navbar.pug`, added `public/js/profile.js`, rebuilt `public/css/app.css`.
  - Tests & checks:
    - `tests/profile.test.js` added (`formatPrismaTime`, profile view/edit + project links, real `sharp`/`file-type` 400x400 avatar upload + fake-image rejection + `/uploads` serving + multipart CSRF, approved-only & no-dual-type skills + ownership, availability overlap/end-time/ownership).
    - `npm run lint` passes (0 errors/warnings); `npm run build:css` passes (`Done in 409ms`); `npx jest --runInBand --detectOpenHandles` passes (4/4 suites, 22/22 tests).

## Decisions

Decisions made outside [docs/ARCHITECTURE.md](ARCHITECTURE.md):

1. **Session table name & test store (`src/config/session.js`)**: Configured `express-mysql-session` to store sessions in `express_sessions` (via `schema.tableName`) to avoid colliding with the domain `sessions` table. Cookie name is `skillswap.sid` with a 7-day `maxAge`. In `NODE_ENV === 'test'`, falls back to Express's in-memory store.
2. **MySQL session pool (`src/config/db.js`)**: Created a `mysql2/promise` pool (`connectionLimit: 10`) parsed from `DATABASE_URL` for `express-mysql-session`.
3. **Extra schema timestamps, indexes, and delete rules (`prisma/schema.prisma`)**:
   - Added `updated_at` (`@updatedAt`) to `swap_requests` and `sessions`.
   - Added composite index `(sender_id, receiver_id, sent_at)` on `messages`.
   - Configured `onDelete: Cascade` on user-owned/child relations and `onDelete: SetNull` on `points_transactions.session_id` and `reports.reported_user_id`.
4. **Seed admin user & env variable (`prisma/seed.js`, `.env.example`)**: Added `SEED_ADMIN_PASSWORD` (beyond section 12 of `ARCHITECTURE.md`) so `prisma/seed.js` creates `admin@skillswap.local` with `STARTER_POINTS` and a `bonus` transaction idempotently.
5. **Non-production env defaults (`src/config/env.js`)**: Provided dev/test fallback defaults for `DATABASE_URL` and `SESSION_SECRET` when `NODE_ENV !== 'production'`, and enforced a 12-char minimum on `SESSION_SECRET` outside `test`.
6. **Helmet CSP & Tailwind plugins (`src/app.js`, `tailwind.config.js`)**: Enabled Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), `data:` images, and `'unsafe-inline'` styles in Helmet CSP; included `@tailwindcss/forms` and `@tailwindcss/container-queries` plus theme palette/fonts matching `frontend-original/`.
7. **Health check & placeholder home (`src/app.js`)**: Added `GET /health` (`200 { status: 'ok' }`) and a temporary `GET /` rendering `pages/home`.
8. **Registration name & confirmation fields (`src/validators/authValidator.js`, `src/views/pages/register.pug`)**: `frontend-original/begin/signup.html` uses `firstName`, `lastName`, and `confirmPassword`, whereas `users.name` is a single column. `registerSchema` accepts `firstName` + `lastName` (concatenated into `name`) or `name`, and enforces `confirmPassword === password`.
9. **Auth session & response semantics (`src/controllers/authController.js`, `src/services/authService.js`)**:
   - Successful registration and login both regenerate the session (`req.session.regenerate`), rotate the CSRF token, flash a success message, and redirect to `/`.
   - Auth failures re-render the form with explicit HTTP status codes (`400` Zod validation, `401` invalid credentials, `403` suspended account checked after password verification, `409` duplicate email), flash error messages, and safe repopulated fields (`firstName`, `lastName`, `email` — never passwords).
   - `POST /logout` destroys the session, clears `skillswap.sid`, and redirects to `/login`.
10. **CSRF configuration (`src/middlewares/csrf.js`, `src/middlewares/upload.js`)**: Configured `csrf-csrf` (`doubleCsrf`) with cookie `skillswap.x-csrf-token` (`__Host-skillswap.x-csrf-token` with `secure: true` in production), reading tokens from `req.body._csrf` or `x-csrf-token`, using `String(req.session?.user?.id || 'guest')` as the session identifier, and force-rotating the cookie via `rotateCsrfToken` on login/register. Global `csrfProtection` skips `POST /profile/avatar` so `multer` can parse `multipart/form-data` first, followed immediately by `verifyMultipartCsrf` (which deletes the temp file if CSRF fails).
11. **Rate limit configuration (`src/middlewares/rateLimiter.js`)**: Applied `loginLimiter` and `registerLimiter` (20 requests per 15 minutes per IP) on `POST /login` and `POST /register` (leaving `GET` views unrestricted), rendering `pages/error` with status `429`.
12. **Auth client JS & omitted forgot-password link (`public/js/auth.js`, `src/views/pages/{login,register}.pug`)**: Extracted inline JS from `login.html` and `signup.html` into `public/js/auth.js` to satisfy Helmet's `script-src 'self'` CSP, kept native POST submission instead of static HTML mock redirects, and omitted the unrouted `forgot-password.html` link per `ARCHITECTURE.md`.
13. **Validation & error helper (`src/utils/AppError.js`, `src/middlewares/validate.js`, `src/middlewares/errorHandler.js`)**: Added `AppError` (statusCode + `fieldErrors`), `validate` middleware with `view` and `onError` hooks for status `400` form re-renders, and `400`/`401`/`429` status titles in `errorHandler.js`.
14. **Project links via `/profile/edit` (`src/validators/profileValidator.js`, `src/models/userModel.js`, `src/views/pages/profileEdit.pug`, `public/js/profile.js`)**: Managed `user_project_links` inside `GET/POST /profile/edit` (up to 10 deduplicated `http://`/`https://` URLs replaced atomically in `prisma.$transaction`) rather than adding extra routes outside section 8.
15. **Avatar storage path & cleanup (`src/services/storageService.js`, `src/services/profileService.js`)**: Stored relative path `<uploadDir>/<uuid>.<ext>` (e.g., `uploads/<uuid>.png`) in `users.avatar_path` to pair with `/uploads` static serving, auto-oriented images via `sharp().rotate().resize(400, 400, { fit: 'cover' })`, and deleted temporary uploads and replaced avatar files.
16. **Public profile access (`src/routes/profileRoutes.js`, `src/services/profileService.js`)**: `GET /users/:id` requires `requireAuth`, hides private fields (`email`, `pointsBalance`) for peer views, and returns `404` for missing or `suspended` users.
17. **Prisma `Time` formatting & adjacent availability (`src/utils/time.js`, `src/services/availabilityService.js`)**: `formatPrismaTime` reads UTC hours/minutes (`getUTCHours`/`getUTCMinutes`) to avoid local timezone offset shifts, and overlap checking uses half-open intervals (`newStart < existingEnd && existingStart < newEnd`) so adjacent back-to-back slots are allowed.
18. **Navbar links (`src/views/partials/navbar.pug`)**: Added `Skills` (`/skills`) and `Availability` (`/availability`) links for authenticated users.

## Known issues

- **Sandbox restrictions on Windows**: Inside the sandbox, `npm test` fails Supertest loopback binds (`connect EACCES 127.0.0.1:<port>`), `npm run build:css` fails with `EPERM` opening `public/css/app.css`, and `.git/*.lock` file creation fails with `Permission denied`. All succeed when run outside the sandbox.
- **DB runtime / seed status unverified here**: MySQL container startup, `prisma migrate dev`, and `prisma/seed.js` execution remain unverified (`localhost:3306` unreachable from sandbox). Phase 2 & Phase 3 tests use in-memory transactional Prisma mocks.
- **Prisma `package.json#prisma` deprecation warning**: `npx prisma validate` warns that `package.json#prisma` is deprecated and will be removed in Prisma 7.
- **`frontend-original/` vs. section 8 routes**: `frontend-original/` contains subdirectories (`begin/`, `admin/`, `chat/`, `coins/`, `notification/`, `points/`, `schedulers/`, `search/`, `session/`, `swap/`, `user1..user10/`). Before Phase 4, map exact HTML pages to section 8 routes and ask the team about any mismatches.

## Next

- Review Phase 3 on branch `phase-3-profile` (and commit/merge when ready), and verify MySQL migration + seed when Docker/MySQL is running.
- Before **Phase 4** ("Convert the remaining pages to Pug"), reconcile the full list of `frontend-original/` HTML files against section 8 routes per `docs/ARCHITECTURE.md`.
