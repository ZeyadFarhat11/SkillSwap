const request = require('supertest');
const bcrypt = require('bcrypt');

const mockState = {
  users: [],
  skills: [],
  sessions: [],
  pointsTransactions: [],
  reports: [],
  nextIds: { user: 1, report: 1, tx: 1 },
};

function resetMockState() {
  mockState.users.length = 0;
  mockState.skills.length = 0;
  mockState.sessions.length = 0;
  mockState.pointsTransactions.length = 0;
  mockState.reports.length = 0;
  mockState.nextIds = { user: 1, report: 1, tx: 1 };
}

jest.mock('../src/models/prisma', () => ({
  user: {
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.users.find((u) =>
        where.email !== undefined ? u.email === where.email : u.id === where.id
      );
      return found ? { ...found } : null;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.users
        .filter((u) => {
          if (where?.id?.not !== undefined && u.id === where.id.not) return false;
          if (where?.status !== undefined && u.status !== where.status) return false;
          return true;
        })
        .map((u) => ({ id: u.id, name: u.name }))
    ),
  },
  report: {
    create: jest.fn(async ({ data }) => {
      const created = {
        id: mockState.nextIds.report++,
        ...data,
        createdAt: new Date(),
      };
      mockState.reports.push(created);
      return { ...created };
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.reports
        .filter((r) => (where?.submitterId !== undefined ? r.submitterId === where.submitterId : true))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({
          ...r,
          reportedUser: r.reportedUserId
            ? mockState.users.find((u) => u.id === r.reportedUserId) || null
            : null,
        }))
    ),
  },
  pointsTransaction: {
    findMany: jest.fn(async ({ where }) =>
      mockState.pointsTransactions
        .filter((pt) => (where?.userId !== undefined ? pt.userId === where.userId : true))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((pt) => {
          const sess = pt.sessionId
            ? mockState.sessions.find((s) => s.id === pt.sessionId)
            : null;
          return {
            ...pt,
            session: sess
              ? {
                  id: sess.id,
                  skill: mockState.skills.find((sk) => sk.id === sess.skillId) || {
                    skillName: 'Skill',
                  },
                }
              : null,
          };
        })
    ),
  },
}));

const app = require('../src/app');
const { POINTS_TYPES, REPORT_STATUSES, STARTER_POINTS } = require('../src/config/constants');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"|value="([^"]+)"\s+name="_csrf"/);
  return match ? match[1] || match[2] : null;
}

async function seedUser({ name, email, pointsBalance = STARTER_POINTS }) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = {
    id: mockState.nextIds.user++,
    name,
    email,
    passwordHash,
    role: 'user',
    status: 'active',
    bio: null,
    avatarPath: null,
    pointsBalance,
    createdAt: new Date(),
  };
  mockState.users.push(user);
  return user;
}

async function loginAgent(email) {
  const agent = request.agent(app);
  const loginPage = await agent.get('/login');
  const csrf = extractCsrfToken(loginPage.text);
  const res = await agent.post('/login').type('form').send({
    _csrf: csrf,
    email,
    password: 'Password123!',
  });
  expect(res.statusCode).toBe(302);
  return agent;
}

describe('Phase 6 Reports & Points History', () => {
  beforeEach(() => {
    resetMockState();
    jest.clearAllMocks();
  });

  test('POST /reports validates inputs, rejects CSRF/self-report/missing user, and persists open reports', async () => {
    const alice = await seedUser({ name: 'Alice Reporter', email: 'alice@test.com' });
    const bob = await seedUser({ name: 'Bob Reported', email: 'bob@test.com' });

    expect((await request(app).get('/reports')).statusCode).toBe(302);

    const agent = await loginAgent(alice.email);
    const page = await agent.get(`/reports?userId=${bob.id}`);
    expect(page.statusCode).toBe(200);
    expect(page.text).toContain('Bob Reported');
    const csrf = extractCsrfToken(page.text);

    // Missing CSRF -> 403
    expect(
      (
        await agent.post('/reports').type('form').send({
          type: 'bug',
          subject: 'Broken button',
          description: 'Clicking the button does nothing at all.',
        })
      ).statusCode
    ).toBe(403);

    // Whitespace / short subject & description -> 400 re-rendering reports page
    const badRes = await agent.post('/reports').type('form').send({
      _csrf: csrf,
      type: 'bug',
      subject: 'Hi',
      description: 'Short',
    });
    expect(badRes.statusCode).toBe(400);
    expect(badRes.text).toContain('at least 3 characters');

    // Invalid report type -> 400
    const badType = await agent.post('/reports').type('form').send({
      _csrf: csrf,
      type: 'invalid_enum',
      subject: 'Valid subject',
      description: 'This description is plenty long enough.',
    });
    expect(badType.statusCode).toBe(400);

    // Self-report rejected -> 400
    const selfRes = await agent.post('/reports').type('form').send({
      _csrf: csrf,
      type: 'user',
      reportedUserId: alice.id,
      subject: 'Self report test',
      description: 'Trying to report myself should be blocked.',
    });
    expect(selfRes.statusCode).toBe(400);
    expect(selfRes.text).toContain('cannot report yourself');

    // Nonexistent target user -> 404
    const missingUserRes = await agent.post('/reports').type('form').send({
      _csrf: csrf,
      type: 'user',
      reportedUserId: 9999,
      subject: 'Missing user report',
      description: 'Trying to report an unknown user ID.',
    });
    expect(missingUserRes.statusCode).toBe(404);

    // Valid general bug report (no reportedUserId) + valid user report
    const okBug = await agent.post('/reports').type('form').send({
      _csrf: csrf,
      type: 'bug',
      reportedUserId: '',
      subject: '  Upload error message  ',
      description: '  Avatar upload error banner wraps awkwardly on mobile.  ',
    });
    expect(okBug.statusCode).toBe(302);
    expect(okBug.headers.location).toBe('/reports');

    const okUser = await agent.post('/reports').type('form').send({
      _csrf: csrf,
      type: 'user',
      reportedUserId: bob.id,
      subject: 'Missed session without notice',
      description: 'Did not join the scheduled Wednesday 10:00 UTC session.',
    });
    expect(okUser.statusCode).toBe(302);

    expect(mockState.reports).toHaveLength(2);
    expect(mockState.reports[0]).toMatchObject({
      submitterId: alice.id,
      reportedUserId: null,
      type: 'bug',
      subject: 'Upload error message',
      status: REPORT_STATUSES.OPEN,
    });
    expect(mockState.reports[1]).toMatchObject({
      submitterId: alice.id,
      reportedUserId: bob.id,
      type: 'user',
      status: REPORT_STATUSES.OPEN,
    });

    const afterPage = await agent.get('/reports');
    expect(afterPage.statusCode).toBe(200);
    expect(afterPage.text).toContain('Your Submitted Reports');
    expect(afterPage.text).toContain('Missed session without notice');
    expect(afterPage.text).toContain('Bob Reported');
  });

  test('GET /points renders real wallet balance, totals, current-month credits, and history', async () => {
    // 20 bonus (last month) + 10 earn (this month) - 10 spend (this month) + 5 adjustment (this month) = 25
    const alice = await seedUser({ name: 'Alice Points', email: 'alicep@test.com', pointsBalance: 25 });
    mockState.skills.push({ id: 1, skillName: 'Python Programming' });
    mockState.skills.push({ id: 2, skillName: 'Guitar' });
    mockState.sessions.push({ id: 10, skillId: 1 });
    mockState.sessions.push({ id: 11, skillId: 2 });

    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));

    mockState.pointsTransactions.push(
      {
        id: mockState.nextIds.tx++,
        userId: alice.id,
        sessionId: null,
        type: POINTS_TYPES.BONUS,
        amount: 20,
        createdAt: lastMonth,
      },
      {
        id: mockState.nextIds.tx++,
        userId: alice.id,
        sessionId: 10,
        type: POINTS_TYPES.EARN,
        amount: 10,
        createdAt: now,
      },
      {
        id: mockState.nextIds.tx++,
        userId: alice.id,
        sessionId: 11,
        type: POINTS_TYPES.SPEND,
        amount: 10,
        createdAt: now,
      },
      {
        id: mockState.nextIds.tx++,
        userId: alice.id,
        sessionId: null,
        type: POINTS_TYPES.ADJUSTMENT,
        amount: 5,
        createdAt: now,
      }
    );

    const agent = await loginAgent(alice.email);
    const res = await agent.get('/points');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('25'); // current balance
    expect(res.text).toContain('35 points'); // Total Earned = 20 + 10 + 5
    expect(res.text).toContain('10 points'); // Total Spent = 10
    expect(res.text).toContain('15 points'); // This Month Credits = 10 + 5
    expect(res.text).toContain('Welcome starter bonus');
    expect(res.text).toContain('Earned – taught Python Programming');
    expect(res.text).toContain('Spent – learned Guitar');
    expect(res.text).toContain('Points adjustment');
    expect(res.text).toContain('+10 pts');
    expect(res.text).toContain('-10 pts');
  });
});
