const express = require('express');
const request = require('supertest');
const bcrypt = require('bcrypt');

// Mock Prisma client with an in-memory transactional store before loading app/services.
const mockUsers = [];
const mockPointsTransactions = [];
let nextUserId = 1;
let nextTxId = 1;
let transactionCount = 0;

function resetMockDb() {
  mockUsers.length = 0;
  mockPointsTransactions.length = 0;
  nextUserId = 1;
  nextTxId = 1;
  transactionCount = 0;
}

const mockTxClient = {
  user: {
    create: jest.fn(async ({ data }) => {
      const duplicate = mockUsers.find((u) => u.email === data.email);
      if (duplicate) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
      const user = {
        id: nextUserId++,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role || 'user',
        status: data.status || 'active',
        pointsBalance: data.pointsBalance ?? 0,
        avatarPath: data.avatarPath || null,
        bio: data.bio || null,
        createdAt: new Date(),
      };
      mockUsers.push(user);
      return { ...user };
    }),
  },
  pointsTransaction: {
    create: jest.fn(async ({ data }) => {
      const tx = {
        id: nextTxId++,
        userId: data.userId,
        sessionId: data.sessionId || null,
        type: data.type,
        amount: data.amount,
        createdAt: new Date(),
      };
      mockPointsTransactions.push(tx);
      return { ...tx };
    }),
  },
};

jest.mock('../src/models/prisma', () => ({
  user: {
    findUnique: jest.fn(async ({ where }) => {
      if (where.email !== undefined) {
        const found = mockUsers.find((u) => u.email === where.email);
        return found ? { ...found } : null;
      }
      if (where.id !== undefined) {
        const found = mockUsers.find((u) => u.id === where.id);
        return found ? { ...found } : null;
      }
      return null;
    }),
  },
  $transaction: jest.fn(async (callback) => {
    transactionCount += 1;
    // Snapshot arrays so a failed callback rolls back atomically.
    const usersSnapshot = mockUsers.map((u) => ({ ...u }));
    const txSnapshot = mockPointsTransactions.map((t) => ({ ...t }));
    try {
      return await callback(mockTxClient);
    } catch (err) {
      mockUsers.length = 0;
      mockUsers.push(...usersSnapshot);
      mockPointsTransactions.length = 0;
      mockPointsTransactions.push(...txSnapshot);
      throw err;
    }
  }),
}));

const app = require('../src/app');
const authService = require('../src/services/authService');
const { requireAuth, requireRole } = require('../src/middlewares/auth');
const { createRateLimiter } = require('../src/middlewares/rateLimiter');
const { errorHandler } = require('../src/middlewares/errorHandler');
const { STARTER_POINTS, POINTS_TYPES } = require('../src/config/constants');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"|value="([^"]+)"\s+name="_csrf"/);
  return match ? match[1] || match[2] : null;
}

describe('Phase 2 Auth service (unit & transaction)', () => {
  beforeEach(() => {
    resetMockDb();
    jest.clearAllMocks();
  });

  test('registerUser creates user and STARTER_POINTS bonus transaction in one transaction', async () => {
    const user = await authService.registerUser({
      name: 'Alice Wonder',
      email: 'Alice@Example.com',
      password: 'Password123!',
    });

    expect(transactionCount).toBe(1);
    expect(user).toMatchObject({
      name: 'Alice Wonder',
      email: 'alice@example.com',
      role: 'user',
      status: 'active',
      pointsBalance: STARTER_POINTS,
    });
    expect(user.passwordHash).toBeUndefined();

    expect(mockUsers).toHaveLength(1);
    expect(await bcrypt.compare('Password123!', mockUsers[0].passwordHash)).toBe(true);

    expect(mockPointsTransactions).toHaveLength(1);
    expect(mockPointsTransactions[0]).toMatchObject({
      userId: user.id,
      type: POINTS_TYPES.BONUS,
      amount: STARTER_POINTS,
    });
  });

  test('registerUser rejects duplicate email with 409', async () => {
    await authService.registerUser({
      name: 'Alice Wonder',
      email: 'alice@example.com',
      password: 'Password123!',
    });

    await expect(
      authService.registerUser({
        name: 'Alice Two',
        email: 'ALICE@example.com',
        password: 'Password123!',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'An account with this email already exists.',
    });
  });

  test('loginUser rejects wrong password and suspended users', async () => {
    await authService.registerUser({
      name: 'Bob Builder',
      email: 'bob@example.com',
      password: 'Password123!',
    });

    await expect(
      authService.loginUser({ email: 'bob@example.com', password: 'WrongPassword!' })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password.',
    });

    mockUsers[0].status = 'suspended';

    await expect(
      authService.loginUser({ email: 'bob@example.com', password: 'Password123!' })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Your account has been suspended. Please contact support.',
    });
  });
});

describe('Phase 2 Auth routes, CSRF, sessions, and middleware', () => {
  beforeEach(() => {
    resetMockDb();
    jest.clearAllMocks();
  });

  test('GET /register and GET /login render Pug pages with CSRF tokens', async () => {
    const regRes = await request(app).get('/register');
    expect(regRes.statusCode).toBe(200);
    expect(regRes.text).toContain('Sign Up');
    expect(regRes.text).toContain('name="_csrf"');
    expect(extractCsrfToken(regRes.text)).toBeTruthy();

    const loginRes = await request(app).get('/login');
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.text).toContain('Log in');
    expect(loginRes.text).toContain('name="_csrf"');
    expect(extractCsrfToken(loginRes.text)).toBeTruthy();
  });

  test('POST /register and POST /login reject missing CSRF token with 403', async () => {
    const regRes = await request(app).post('/register').type('form').send({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(regRes.statusCode).toBe(403);
    expect(regRes.text).toContain('Forbidden');

    const loginRes = await request(app).post('/login').type('form').send({
      email: 'ada@example.com',
      password: 'Password123!',
    });
    expect(loginRes.statusCode).toBe(403);
  });

  test('POST /register validates inputs with Zod and renders flash error on invalid data', async () => {
    const agent = request.agent(app);
    const getRes = await agent.get('/register');
    const csrf = extractCsrfToken(getRes.text);

    const badRes = await agent.post('/register').type('form').send({
      _csrf: csrf,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'short',
      confirmPassword: 'short',
    });

    expect(badRes.statusCode).toBe(400);
    expect(badRes.text).toContain('Password must be at least 8 characters.');
    expect(badRes.text).toContain('value="Ada"');
    expect(mockUsers).toHaveLength(0);
  });

  test('POST /register creates user + starter points, logs in, and rejects duplicate email', async () => {
    const agent = request.agent(app);
    const getRes = await agent.get('/register');
    const csrf = extractCsrfToken(getRes.text);

    const regRes = await agent.post('/register').type('form').send({
      _csrf: csrf,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    expect(regRes.statusCode).toBe(302);
    expect(regRes.headers.location).toBe('/');
    expect(mockUsers).toHaveLength(1);
    expect(mockPointsTransactions).toHaveLength(1);
    expect(mockPointsTransactions[0].amount).toBe(STARTER_POINTS);

    const homeRes = await agent.get('/');
    expect(homeRes.statusCode).toBe(200);
    expect(homeRes.text).toContain('Ada Lovelace');
    expect(homeRes.text).toContain(`You received ${STARTER_POINTS} starter points`);

    // Second registration with same email (fresh agent) returns 409 + flash message
    const agent2 = request.agent(app);
    const getRes2 = await agent2.get('/register');
    const csrf2 = extractCsrfToken(getRes2.text);

    const dupRes = await agent2.post('/register').type('form').send({
      _csrf: csrf2,
      firstName: 'Another',
      lastName: 'Ada',
      email: 'ADA@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.text).toContain('An account with this email already exists.');
    expect(mockUsers).toHaveLength(1);
  });

  test('POST /login handles wrong password, suspended user, session regeneration, and logout', async () => {
    const registered = await authService.registerUser({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'Password123!',
    });

    const agent = request.agent(app);

    // Trigger an existing pre-login session cookie via failed login flash or check cookie rotation on login
    const loginPage = await agent.get('/login');
    const csrf = extractCsrfToken(loginPage.text);

    // Wrong password
    const wrongRes = await agent.post('/login').type('form').send({
      _csrf: csrf,
      email: 'grace@example.com',
      password: 'WrongPassword!',
    });
    expect(wrongRes.statusCode).toBe(401);
    expect(wrongRes.text).toContain('Invalid email or password.');

    // Suspended user
    mockUsers.find((u) => u.id === registered.id).status = 'suspended';
    const suspendedRes = await agent.post('/login').type('form').send({
      _csrf: csrf,
      email: 'grace@example.com',
      password: 'Password123!',
    });
    expect(suspendedRes.statusCode).toBe(403);
    expect(suspendedRes.text).toContain('Your account has been suspended');

    // Reactivate user and test successful login + session regeneration
    mockUsers.find((u) => u.id === registered.id).status = 'active';
    const successRes = await agent.post('/login').type('form').send({
      _csrf: csrf,
      email: 'grace@example.com',
      password: 'Password123!',
    });
    expect(successRes.statusCode).toBe(302);
    expect(successRes.headers.location).toBe('/');
    const setCookies = successRes.headers['set-cookie'] || [];
    const sidCookie = setCookies.find((c) => c.startsWith('skillswap.sid='));
    expect(sidCookie).toBeTruthy();

    const homeRes = await agent.get('/');
    expect(homeRes.statusCode).toBe(200);
    expect(homeRes.text).toContain('Grace Hopper');
    expect(homeRes.text).toContain('Welcome back!');

    // Logout requires CSRF and clears session
    const postLoginCsrf = extractCsrfToken(homeRes.text);
    const badLogout = await agent.post('/logout').type('form').send({});
    expect(badLogout.statusCode).toBe(403);

    const logoutRes = await agent.post('/logout').type('form').send({ _csrf: postLoginCsrf });
    expect(logoutRes.statusCode).toBe(302);
    expect(logoutRes.headers.location).toBe('/login');

    const homeAfterLogout = await agent.get('/');
    expect(homeAfterLogout.text).not.toContain('Grace Hopper');
  });

  test('POST /login regenerates an existing session ID', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    mockUsers.push({
      id: 99,
      name: 'Session Tester',
      email: 'session@example.com',
      passwordHash,
      role: 'user',
      status: 'active',
      pointsBalance: 20,
    });

    const miniApp = express();
    const session = require('express-session');
    const cookieParser = require('cookie-parser');
    miniApp.use(express.urlencoded({ extended: false }));
    miniApp.use(cookieParser('test-secret-1234'));
    miniApp.use(session({ secret: 'test-secret-1234', resave: false, saveUninitialized: true }));
    miniApp.use((req, _res, next) => {
      req.flash = () => [];
      next();
    });

    const { login } = require('../src/controllers/authController');
    const { validate } = require('../src/middlewares/validate');
    const { loginSchema } = require('../src/validators/authValidator');

    let preLoginSid;
    let postLoginSid;
    miniApp.get('/probe', (req, res) => {
      preLoginSid = req.sessionID;
      res.status(200).send(preLoginSid);
    });
    miniApp.post('/login', validate(loginSchema), (req, res, next) => {
      const origRegenerate = req.session.regenerate.bind(req.session);
      req.session.regenerate = (cb) =>
        origRegenerate((err) => {
          postLoginSid = req.sessionID;
          cb(err);
        });
      login(req, res, next);
    });
    miniApp.use(errorHandler);

    const agent = request.agent(miniApp);
    await agent.get('/probe');
    const res = await agent.post('/login').type('form').send({
      email: 'session@example.com',
      password: 'Password123!',
    });

    expect(res.statusCode).toBe(302);
    expect(preLoginSid).toBeTruthy();
    expect(postLoginSid).toBeTruthy();
    expect(postLoginSid).not.toBe(preLoginSid);
  });

  test('requireAuth and requireRole enforce authentication and role authorization', async () => {
    const miniApp = express();
    const session = require('express-session');
    const flash = require('connect-flash');
    miniApp.set('views', require('path').join(__dirname, '..', 'src', 'views'));
    miniApp.set('view engine', 'pug');
    miniApp.use(express.urlencoded({ extended: false }));
    miniApp.use(session({ secret: 'test-secret-1234', resave: false, saveUninitialized: false }));
    miniApp.use(flash());
    miniApp.use((req, res, next) => {
      res.locals.currentUser = req.session?.user || null;
      res.locals.csrfToken = null;
      res.locals.flash = { error: req.flash('error'), success: [], info: [] };
      next();
    });

    miniApp.post('/test-set-user', express.json(), (req, res) => {
      req.session.user = req.body;
      res.status(200).json({ ok: true });
    });
    miniApp.get('/protected', requireAuth, (_req, res) => res.status(200).send('ok'));
    miniApp.get('/admin-only', requireAuth, requireRole('admin'), (_req, res) =>
      res.status(200).send('admin ok')
    );
    miniApp.use(errorHandler);

    const agent = request.agent(miniApp);

    // Unauthenticated -> redirects to /login
    const unauthRes = await agent.get('/protected');
    expect(unauthRes.statusCode).toBe(302);
    expect(unauthRes.headers.location).toBe('/login');

    // Standard user -> passes requireAuth, blocked by requireRole('admin') with 403
    await agent.post('/test-set-user').send({ id: 1, name: 'U', role: 'user', status: 'active' });
    expect((await agent.get('/protected')).statusCode).toBe(200);
    const forbiddenRes = await agent.get('/admin-only');
    expect(forbiddenRes.statusCode).toBe(403);
    expect(forbiddenRes.text).toContain('Forbidden');

    // Admin user -> allowed
    await agent.post('/test-set-user').send({ id: 2, name: 'A', role: 'admin', status: 'active' });
    const adminRes = await agent.get('/admin-only');
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.text).toBe('admin ok');
  });

  test('rateLimiter returns 429 friendly page when limit is exceeded', async () => {
    const miniApp = express();
    miniApp.set('views', require('path').join(__dirname, '..', 'src', 'views'));
    miniApp.set('view engine', 'pug');
    miniApp.use((req, res, next) => {
      res.locals.currentUser = null;
      res.locals.csrfToken = null;
      res.locals.flash = { error: [], success: [], info: [] };
      next();
    });
    const limiter = createRateLimiter({ windowMs: 60000, limit: 2 });
    miniApp.post('/limited', limiter, (_req, res) => res.status(200).send('ok'));

    expect((await request(miniApp).post('/limited')).statusCode).toBe(200);
    expect((await request(miniApp).post('/limited')).statusCode).toBe(200);
    const blocked = await request(miniApp).post('/limited');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.text).toContain('Too Many Requests');
  });
});
