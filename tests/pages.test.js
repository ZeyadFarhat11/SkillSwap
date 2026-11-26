const request = require('supertest');
const bcrypt = require('bcrypt');

const mockUsers = [];
const mockSessions = [];
let nextId = 1;

jest.mock('../src/models/prisma', () => ({
  user: {
    findUnique: jest.fn(async ({ where }) => {
      const found = mockUsers.find((u) =>
        where.email !== undefined ? u.email === where.email : u.id === where.id
      );
      return found ? { ...found } : null;
    }),
    findMany: jest.fn(async () => []),
  },
  userSkill: {
    findMany: jest.fn(async () => []),
  },
  swapRequest: {
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  },
  session: {
    findMany: jest.fn(async () => []),
    findUnique: jest.fn(async ({ where }) => {
      const found = mockSessions.find((s) => s.id === where.id);
      return found ? { ...found } : null;
    }),
  },
}));

const app = require('../src/app');
const { STARTER_POINTS } = require('../src/config/constants');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"|value="([^"]+)"\s+name="_csrf"/);
  return match ? match[1] || match[2] : null;
}

async function seedAndLogin({ name, email, role = 'user' }) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = {
    id: nextId++,
    name,
    email,
    passwordHash,
    role,
    status: 'active',
    pointsBalance: STARTER_POINTS,
    avatarPath: null,
    createdAt: new Date(),
  };
  mockUsers.push(user);

  const agent = request.agent(app);
  const loginPage = await agent.get('/login');
  const csrf = extractCsrfToken(loginPage.text);
  const res = await agent.post('/login').type('form').send({
    _csrf: csrf,
    email,
    password: 'Password123!',
  });
  expect(res.statusCode).toBe(302);
  expect(res.headers.location).toBe('/suggestions');
  return { agent, user };
}

describe('Phase 4 Converted Pug pages & route guards', () => {
  beforeEach(() => {
    mockUsers.length = 0;
    mockSessions.length = 0;
    nextId = 1;
  });

  test('GET / renders guest welcome page and redirects authenticated users to /suggestions', async () => {
    const guestRes = await request(app).get('/');
    expect(guestRes.statusCode).toBe(200);
    expect(guestRes.text).toContain('Share what you know');
    expect(guestRes.text).toContain('Sign Up');
    expect(guestRes.text).toContain('Log In');

    const { agent: userAgent } = await seedAndLogin({
      name: 'Alice Page',
      email: 'alicep@example.com',
    });
    const authedRoot = await userAgent.get('/');
    expect(authedRoot.statusCode).toBe(302);
    expect(authedRoot.headers.location).toBe('/suggestions');
  });

  test('authenticated user can view all user-facing Pug pages', async () => {
    const { agent, user } = await seedAndLogin({
      name: 'Alice Page',
      email: 'alice2@example.com',
    });

    mockSessions.push({
      id: 1,
      swapRequestId: 1,
      instructorId: user.id + 1,
      learnerId: user.id,
      skillId: 1,
      dateTime: new Date(),
      status: 'completed',
      instructor: { id: user.id + 1, name: 'Salma Mohammed' },
      learner: user,
      skill: { id: 1, skillName: 'Python Programming' },
      ratings: [],
      swapRequest: null,
    });

    const routes = [
      ['/welcome', 'You Earned Points!'],
      ['/welcome', `+${STARTER_POINTS}`],
      ['/suggestions', 'Highly Recommended Match'],
      ['/requests', 'Swap Requests'],
      ['/sessions', 'Your Schedule'],
      ['/sessions/1/review', 'Leave a Review'],
      ['/messages', 'Messages'],
      ['/messages/2', 'Salma Mohammed'],
      ['/points', 'Points Wallet'],
      ['/reports', 'Submit a Report'],
    ];

    for (const [routePath, expectedText] of routes) {
      const res = await agent.get(routePath);
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain(expectedText);
    }
  });

  test('admin routes block non-admins with 403 and render for admins', async () => {
    const { agent: userAgent } = await seedAndLogin({
      name: 'Regular User',
      email: 'reg@example.com',
      role: 'user',
    });
    for (const adminPath of ['/admin/users', '/admin/skills', '/admin/reports']) {
      const unauth = await request(app).get(adminPath);
      expect(unauth.statusCode).toBe(302);
      expect(unauth.headers.location).toBe('/login');

      const forbidden = await userAgent.get(adminPath);
      expect(forbidden.statusCode).toBe(403);
    }

    const { agent: adminAgent } = await seedAndLogin({
      name: 'Admin User',
      email: 'adm@example.com',
      role: 'admin',
    });
    const usersRes = await adminAgent.get('/admin/users');
    expect(usersRes.statusCode).toBe(200);
    expect(usersRes.text).toContain('User Management');

    const skillsRes = await adminAgent.get('/admin/skills');
    expect(skillsRes.statusCode).toBe(200);
    expect(skillsRes.text).toContain('Skill Management');

    const reportsRes = await adminAgent.get('/admin/reports');
    expect(reportsRes.statusCode).toBe(200);
    expect(reportsRes.text).toContain('Reports Management');
  });
});
