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
  - Tests & checks: `tests/profile.test.js` passing.

- **Phase 4 (Convert remaining pages to Pug with placeholder data)** — implemented and tested:
  - Updated [docs/ARCHITECTURE.md](ARCHITECTURE.md) Section 8 routes table (`GET /`, `GET /welcome`, `GET /sessions/:id/review`).
  - Shared layout & partials:
    - Updated `src/views/layouts/base.pug` to support `useSidebar` and `isAdminLayout` alongside `navbar`/`footer`.
    - Added `src/views/partials/{sidebar,adminSidebar,matchCard,reviews}.pug`; included `partials/reviews` in `src/views/pages/profile.pug`.
  - Converted remaining Pug pages (with placeholder data in `src/controllers/pageController.js` and routes in `src/routes/pageRoutes.js`):
    - `welcome.pug` (`GET /` for guests from `begin/welcome.html`), `welcomePoints.pug` (`GET /welcome` from `begin/get3points.html`), `suggestions.pug` (`GET /suggestions` from `userdash.html`), `requests.pug` (`GET /requests` from `swap/swap.html`), `sessions.pug` (`GET /sessions` from `session/session.html` + `schedulers/scheduler1.html`), `reviewForm.pug` (`GET /sessions/:id/review` from `user1/leaverev1.html`), `messages.pug` (`GET /messages` from `chat/chathis.html`), `chat.pug` (`GET /messages/:userId` from `user1/chat1.html`), `points.pug` (`GET /points` from `points/points.html`), `reports.pug` (`GET /reports` from `user1/report1.html`), `adminUsers.pug` (`GET /admin/users` from `admin/usermange1.html`), `adminSkills.pug` (`GET /admin/skills` from `admin/skill.html`), `adminReports.pug` (`GET /admin/reports` matching the admin table layout).
  - Updated `src/controllers/authController.js` (`register` -> `/welcome`, `login` -> `/suggestions`) and `src/controllers/profileController.js` (passes `reviews: []`, `averageRating: null` placeholder for `partials/reviews`).
  - Tests & checks:
    - Added `tests/pages.test.js`, extended `tests/profile.test.js` (WebP/JPEG + combined `POST /profile/edit` avatar save), and updated `tests/auth.test.js` for `/welcome` and `/suggestions` redirects.
    - All 21 Pug templates compile cleanly; `npm run lint` passes (0 errors/warnings); `npx jest --runInBand --detectOpenHandles` passes (5/5 suites, 26/26 tests).

- **Phase 5 (Swap requests, sessions, and transactional points transfer)** — implemented and tested:
  - Models & validators:
    - Added `src/models/swapRequestModel.js` (`create`, `findById`, `findDuplicatePending`, `findByUserId`, `findAcceptedByUserId`, `countPendingForUser`, `updateStatus`) and `src/models/sessionModel.js` (`createBatch`, `findById`, `findByUserId`, `findActiveBySwapRequestId`, `updateStatus`, and `completeSessionTx` running inside one `prisma.$transaction` with `FOR UPDATE` row locks on session and both users).
    - Updated `src/models/userModel.js` (`findActivePeersWithOfferedSkills`) and `src/models/skillModel.js` (`findApprovedUserSkill`).
    - Added `src/validators/requestValidator.js` (`createRequestSchema`, `requestIdParamSchema`) and `src/validators/sessionValidator.js` (`createSessionSchema` with naive `datetime-local` UTC normalization, `sessionIdParamSchema`).
  - Services, controllers, routes, & views:
    - Added `src/services/requestService.js` (no self-requests, active receiver check, approved offered skill checks, no duplicate pending requests, one-way `POINTS_PER_SESSION` balance check, participant/pending status guards) and `src/services/sessionService.js` (shared availability validation across both users, 1 session for one-way / 2 for mutual, duplicate-scheduling prevention, cancel, completion after `dateTime` with atomic one-way points transfer & parent request completion).
    - Added `src/controllers/{requestController,sessionController}.js`, `src/routes/{requestRoutes,sessionRoutes}.js`, mounted in `src/app.js`, and removed Phase 4 placeholders from `src/controllers/pageController.js` and `src/routes/pageRoutes.js`.
    - Wired real POST forms + CSRF tokens into `src/views/pages/requests.pug` ("Swap With" user cards matching `frontend-original/swap/swap.html` showing each active peer's offered/wanted skills + inline `Request Swap` form, alongside `Accept`/`Decline`/`Cancel`) and `src/views/pages/sessions.pug` (`Schedule Session`, `Complete`, `Cancel`), and rebuilt `public/css/app.css`.
  - Tests & checks:
    - Added `tests/requests.test.js` and updated `tests/pages.test.js` Prisma mocks for `/requests`, `/sessions`, and `/sessions/:id/review`.

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
7. **Health check (`src/app.js`)**: Added `GET /health` (`200 { status: 'ok' }`).
8. **Registration name & confirmation fields (`src/validators/authValidator.js`, `src/views/pages/register.pug`)**: `frontend-original/begin/signup.html` uses `firstName`, `lastName`, and `confirmPassword`, whereas `users.name` is a single column. `registerSchema` accepts `firstName` + `lastName` (concatenated into `name`) or `name`, and enforces `confirmPassword === password`.
9. **Auth session & response semantics (`src/controllers/authController.js`, `src/services/authService.js`)**:
   - Successful registration regenerates the session, rotates the CSRF token, flashes a starter-points message, and redirects to `/welcome`; successful login regenerates the session, rotates the CSRF token, and redirects to `/suggestions`.
   - Auth failures re-render the form with explicit HTTP status codes (`400` Zod validation, `401` invalid credentials, `403` suspended account checked after password verification, `409` duplicate email), flash error messages, and safe repopulated fields (`firstName`, `lastName`, `email` — never passwords).
   - `POST /logout` destroys the session, clears `skillswap.sid`, and redirects to `/login`.
10. **CSRF configuration (`src/middlewares/csrf.js`, `src/middlewares/upload.js`)**: Configured `csrf-csrf` (`doubleCsrf`) with cookie `skillswap.x-csrf-token` (`__Host-skillswap.x-csrf-token` with `secure: true` in production), reading tokens from `req.body._csrf` or `x-csrf-token`, using `String(req.session?.user?.id || 'guest')` as the session identifier, and force-rotating the cookie via `rotateCsrfToken` on login/register. Global `csrfProtection` skips `POST /profile/avatar` and multipart `POST /profile/edit` so `multer` can parse `multipart/form-data` first, followed immediately by `verifyMultipartCsrf` (which deletes the temp file if CSRF fails).
11. **Rate limit configuration (`src/middlewares/rateLimiter.js`)**: Applied `loginLimiter` and `registerLimiter` (20 requests per 15 minutes per IP) on `POST /login` and `POST /register` (leaving `GET` views unrestricted), rendering `pages/error` with status `429`.
12. **Auth client JS & omitted forgot-password link (`public/js/auth.js`, `src/views/pages/{login,register}.pug`)**: Extracted inline JS from `login.html` and `signup.html` into `public/js/auth.js` to satisfy Helmet's `script-src 'self'` CSP, kept native POST submission instead of static HTML mock redirects, and omitted the unrouted `forgot-password.html` link per `ARCHITECTURE.md`.
13. **Validation & error helper (`src/utils/AppError.js`, `src/middlewares/validate.js`, `src/middlewares/errorHandler.js`)**: Added `AppError` (statusCode + `fieldErrors`), `validate` middleware with `view` and `onError` hooks for status `400` form re-renders, and `400`/`401`/`429` status titles in `errorHandler.js`.
14. **Combined profile + avatar save (`src/validators/profileValidator.js`, `src/models/userModel.js`, `src/controllers/profileController.js`, `src/views/pages/profileEdit.pug`, `public/js/profile.js`)**: Managed `user_project_links` inside `GET/POST /profile/edit` (up to 10 deduplicated `http://`/`https://` URLs replaced atomically in `prisma.$transaction`) alongside optional multipart `avatar` upload (previewed locally via `FileReader` and saved only when clicking **Save Changes**, with header link renamed to **Cancel** and `POST /profile/avatar` kept intact for Section 8 compatibility).
15. **Avatar storage path & Windows lock safety (`src/services/storageService.js`, `src/services/profileService.js`)**: Stored normalized relative path `<uploadDir>/<uuid>.<ext>` (e.g., `uploads/<uuid>.png`) in `users.avatar_path` to pair with `/uploads` static serving, disabled `sharp.cache(false)` and processed buffered temp uploads (`fs.readFile` -> `FileType.fromBuffer` -> `sharp(inputBuffer).rotate().resize(400, 400, { fit: 'cover' })`) to avoid Windows `EBUSY` unlink locks (notably on WebP), and deleted temporary and replaced avatar files.
16. **Public profile access (`src/routes/profileRoutes.js`, `src/services/profileService.js`)**: `GET /users/:id` requires `requireAuth`, hides private fields (`email`, `pointsBalance`) for peer views, and returns `404` for missing or `suspended` users.
17. **Prisma `Time` formatting & adjacent availability (`src/utils/time.js`, `src/services/availabilityService.js`)**: `formatPrismaTime` reads UTC hours/minutes (`getUTCHours`/`getUTCMinutes`) to avoid local timezone offset shifts, and overlap checking uses half-open intervals (`newStart < existingEnd && existingStart < newEnd`) so adjacent back-to-back slots are allowed.
18. **Sidebar-only app layout & omitted navbar (`src/views/layouts/base.pug`, `src/views/partials/{sidebar,adminSidebar}.pug`, `src/views/pages/*.pug`)**: Omitted the top `navbar.pug` completely so all authenticated app pages (including Phases 3 and 4 pages) consistently use the left `sidebar` / `adminSidebar` layout (`!hideSidebar && (useSidebar || currentUser)`), while guest/onboarding/standalone views (`welcome`, `welcomePoints`, `login`, `register`, `reviewForm`) pass `hideSidebar: true`. Replaced external `lh3.googleusercontent.com` mock URLs with initials badges (respecting Helmet `imgSrc: ["'self'", 'data:']`), and replaced FontAwesome CDN icons with inline SVGs.
19. **Starter points welcome screen (`src/views/pages/welcomePoints.pug`)**: `frontend-original/begin/get3points.html` displays `+3 POINTS`; `welcomePoints.pug` renders `STARTER_POINTS` dynamically (`+20` by default, or `+3` if `STARTER_POINTS=3` is configured in `.env`).
20. **Swap scheduling, duplicate guards, and UTC wall-clock normalization (`src/validators/sessionValidator.js`, `src/services/sessionService.js`, `src/models/sessionModel.js`)**: Normalized naive HTML `<input type="datetime-local">` strings (`YYYY-MM-DDTHH:mm`) as UTC to match Phase 3 `availability.startTime`/`endTime` UTC wall-clock storage, prevented duplicate active session scheduling on an already-scheduled accepted swap request (allowing reschedule only after cancellation), ordered user `FOR UPDATE` row locks by ascending ID to avoid deadlocks, and marked a parent `swap_request` `completed` when it has at least one `completed` session and no remaining `scheduled` sessions.

## Deferred pages

Pages in `frontend-original/` skipped by team decision (outside `docs/ARCHITECTURE.md` scope for now):

- `frontend-original/index.html`, `frontend-original/begin/splash.html` (meta-refresh / timed splash redirect; `GET /` serves `begin/welcome.html` directly for guests)
- `frontend-original/begin/role.html` (separate role-selection pre-login page; single `/login` route used for all roles)
- `frontend-original/search/search1.html`, `frontend-original/search/search2.html` (separate search pages; `/suggestions` uses `userdash.html`)
- `frontend-original/progress.html` (gamified levels, streaks, badges, certificates)
- `frontend-original/coins/coins.html` (Coins Wallet; `/points` uses `points/points.html`)
- `frontend-original/notification/notification.html` (Notifications page)
- `frontend-original/user1..user10/session1..10.html` (10 static copies — Live Video Session call screen)
- `frontend-original/user1..user10/summary1..10.html` (10 static copies — AI Session Summary & Quiz)
- `frontend-original/admin/login.html` (dropped; admins use `/login`)
- `frontend-original/admin/fee.html` (Fees Management)
- `frontend-original/admin/wallet.html` (Wallet Management)
- `frontend-original/admin/session.html` (Admin Session Management)
- `frontend-original/admin/settings.html` (Admin Settings)

## Known issues

- **Sandbox restrictions on Windows**: Inside the sandbox, `npm test` fails Supertest loopback binds (`connect EACCES 127.0.0.1:<port>`), `npm run build:css` fails with `EPERM` opening `public/css/app.css`, and `.git/*.lock` file creation fails with `Permission denied`. All succeed when run outside the sandbox.
- **DB runtime / seed status unverified here**: MySQL container startup, `prisma migrate dev`, and `prisma/seed.js` execution remain unverified (`localhost:3306` unreachable from sandbox). Phase 2–4 tests use in-memory Prisma mocks.
- **Prisma `package.json#prisma` deprecation warning**: `npx prisma validate` warns that `package.json#prisma` is deprecated and will be removed in Prisma 7.
- **No standalone `GET /reviews` route**: Sidebars in `frontend-original/` do not link to `/reviews`; received reviews render via `partials/reviews.pug` on `/profile` and `/users/:id` (with empty placeholder arrays until Phase 6).

## Next

- Review Phase 5 on `main` (and commit when ready).
- Begin **Phase 6**: Ratings (`POST /sessions/:id/rating` + received reviews on profiles), Messages (`GET /messages`, `GET /messages/:userId`, `POST /messages` with rate limit), Reports (`POST /reports`), and Points history page (`GET /points`).
