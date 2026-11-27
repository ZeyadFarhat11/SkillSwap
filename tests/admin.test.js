const express = require('express');
const request = require('supertest');
const bcrypt = require('bcrypt');

const mockState = {
  users: [],
  skills: [],
  swapRequests: [],
  sessions: [],
  reports: [],
  pointsTransactions: [],
  platformSettings: null,
  rawQueries: [],
  nextIds: { user: 1, skill: 1, swapRequest: 1, session: 1, report: 1, tx: 1 },
};

function resetMockState() {
  mockState.users.length = 0;
  mockState.skills.length = 0;
  mockState.swapRequests.length = 0;
  mockState.sessions.length = 0;
  mockState.reports.length = 0;
  mockState.pointsTransactions.length = 0;
  mockState.platformSettings = null;
  mockState.rawQueries.length = 0;
  mockState.nextIds = { user: 1, skill: 1, swapRequest: 1, session: 1, report: 1, tx: 1 };
}

jest.mock('../src/models/prisma', () => ({
  user: {
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.users.find((u) =>
        where.email !== undefined ? u.email === where.email : u.id === where.id
      );
      return found ? { ...found } : null;
    }),
    findMany: jest.fn(async ({ where } = {}) =>
      mockState.users
        .filter((u) => {
          if (where?.id?.not !== undefined && u.id === where.id.not) return false;
          if (where?.status !== undefined && u.status !== where.status) return false;
          return true;
        })
        .sort((a, b) => a.id - b.id)
        .map((u) => ({ ...u }))
    ),
    update: jest.fn(async ({ where, data }) => {
      const user = mockState.users.find((u) => u.id === where.id);
      if (!user) throw new Error('User not found');
      Object.assign(user, data);
      return { ...user };
    }),
  },
  skill: {
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.skills.find((s) =>
        where.skillName !== undefined ? s.skillName === where.skillName : s.id === where.id
      );
      return found ? { ...found } : null;
    }),
    findMany: jest.fn(async ({ where } = {}) =>
      mockState.skills
        .filter((s) => !where?.status || s.status === where.status)
        .sort((a, b) => a.skillName.localeCompare(b.skillName))
        .map((s) => ({ ...s }))
    ),
    create: jest.fn(async ({ data }) => {
      if (mockState.skills.some((s) => s.skillName === data.skillName)) {
        const err = new Error('Unique constraint');
        err.code = 'P2002';
        throw err;
      }
      const created = { id: mockState.nextIds.skill++, createdAt: new Date(), ...data };
      mockState.skills.push(created);
      return { ...created };
    }),
    update: jest.fn(async ({ where, data }) => {
      const sk = mockState.skills.find((s) => s.id === where.id);
      if (!sk) throw new Error('Skill not found');
      Object.assign(sk, data);
      return { ...sk };
    }),
    delete: jest.fn(async ({ where }) => {
      const idx = mockState.skills.findIndex((s) => s.id === where.id);
      if (idx === -1) throw new Error('Skill not found');
      const [removed] = mockState.skills.splice(idx, 1);
      return { ...removed };
    }),
  },
  userSkill: {
    findMany: jest.fn(async () => []),
  },
  swapRequest: {
    count: jest.fn(async ({ where }) => {
      if (where?.OR) {
        return mockState.swapRequests.filter((sr) =>
          where.OR.some(
            (clause) =>
              (clause.wantedSkillId !== undefined && sr.wantedSkillId === clause.wantedSkillId) ||
              (clause.offeredSkillId !== undefined && sr.offeredSkillId === clause.offeredSkillId)
          )
        ).length;
      }
      return mockState.swapRequests.length;
    }),
  },
  session: {
    count: jest.fn(async ({ where }) =>
      mockState.sessions.filter((s) => (where?.skillId !== undefined ? s.skillId === where.skillId : true)).length
    ),
    findMany: jest.fn(async () =>
      [...mockState.sessions]
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
        .map((s) => ({
          ...s,
          instructor: mockState.users.find((u) => u.id === s.instructorId) || null,
          learner: mockState.users.find((u) => u.id === s.learnerId) || null,
          skill: mockState.skills.find((sk) => sk.id === s.skillId) || null,
          swapRequest: mockState.swapRequests.find((sr) => sr.id === s.swapRequestId) || null,
        }))
    ),
  },
  report: {
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.reports.find((r) => r.id === where.id);
      return found ? { ...found } : null;
    }),
    findMany: jest.fn(async () =>
      [...mockState.reports]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({
          ...r,
          submitter: mockState.users.find((u) => u.id === r.submitterId) || null,
          reportedUser: r.reportedUserId
            ? mockState.users.find((u) => u.id === r.reportedUserId) || null
            : null,
        }))
    ),
    update: jest.fn(async ({ where, data }) => {
      const rep = mockState.reports.find((r) => r.id === where.id);
      if (!rep) throw new Error('Report not found');
      Object.assign(rep, data);
      return { ...rep };
    }),
  },
  pointsTransaction: {
    findMany: jest.fn(async ({ where }) =>
      mockState.pointsTransactions
        .filter((pt) => (where?.userId !== undefined ? pt.userId === where.userId : true))
        .sort((a, b) => b.createdAt - a.createdAt)
    ),
  },
  platformSetting: {
    findUnique: jest.fn(async () =>
      mockState.platformSettings ? { ...mockState.platformSettings } : null
    ),
    upsert: jest.fn(async ({ update, create }) => {
      if (mockState.platformSettings) {
        mockState.platformSettings = {
          ...mockState.platformSettings,
          ...update,
          updatedAt: new Date(),
        };
      } else {
        mockState.platformSettings = {
          ...create,
          updatedAt: new Date(),
        };
      }
      return { ...mockState.platformSettings };
    }),
  },
  $transaction: jest.fn(async (cb) => {
    const snapshotUsers = mockState.users.map((u) => ({ ...u }));
    const snapshotTxns = mockState.pointsTransactions.map((t) => ({ ...t }));

    const mockTx = {
      $queryRaw: jest.fn(async (strings, ...values) => {
        const sqlText = Array.isArray(strings) ? strings.join('?') : String(strings);
        mockState.rawQueries.push(sqlText);
        const ids = values.map(Number).filter((v) => !Number.isNaN(v));
        if (sqlText.includes('FROM users')) {
          return mockState.users
            .filter((u) => ids.includes(u.id))
            .map((u) => ({ id: u.id, points_balance: u.pointsBalance }));
        }
        return [];
      }),
      user: {
        create: jest.fn(async ({ data }) => {
          const created = {
            id: mockState.nextIds.user++,
            bio: null,
            avatarPath: null,
            createdAt: new Date(),
            ...data,
          };
          mockState.users.push(created);
          return { ...created };
        }),
        update: jest.fn(async ({ where, data }) => {
          const user = mockState.users.find((u) => u.id === where.id);
          if (!user) throw new Error('User not found');
          Object.assign(user, data);
          return { ...user };
        }),
      },
      pointsTransaction: {
        create: jest.fn(async ({ data }) => {
          const created = {
            id: mockState.nextIds.tx++,
            sessionId: null,
            ...data,
            createdAt: new Date(),
          };
          mockState.pointsTransactions.push(created);
          return { ...created };
        }),
      },
    };

    try {
      return await cb(mockTx);
    } catch (err) {
      mockState.users.splice(0, mockState.users.length, ...snapshotUsers);
      mockState.pointsTransactions.splice(0, mockState.pointsTransactions.length, ...snapshotTxns);
      throw err;
    }
  }),
}));

const app = require('../src/app');
const { errorHandler } = require('../src/middlewares/errorHandler');
const { STARTER_POINTS } = require('../src/config/constants');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"|value="([^"]+)"\s+name="_csrf"/);
  return match ? match[1] || match[2] : null;
}

async function seedUser({ name, email, role = 'user', status = 'active', pointsBalance = STARTER_POINTS }) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = {
    id: mockState.nextIds.user++,
    name,
    email,
    passwordHash,
    role,
    status,
    bio: null,
    avatarPath: null,
    pointsBalance,
    createdAt: new Date(),
  };
  mockState.users.push(user);
  if (pointsBalance > 0) {
    mockState.pointsTransactions.push({
      id: mockState.nextIds.tx++,
      userId: user.id,
      sessionId: null,
      type: 'bonus',
      amount: pointsBalance,
      createdAt: new Date(),
    });
  }
  return user;
}

function computeBalanceFromTransactions(userId) {
  return mockState.pointsTransactions
    .filter((pt) => pt.userId === userId)
    .reduce((sum, pt) => {
      if (pt.type === 'spend') return sum - pt.amount;
      return sum + pt.amount;
    }, 0);
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

describe('Phase 8 Admin Pages, Moderation, Points Adjustment, Settings & Error Handling', () => {
  beforeEach(() => {
    resetMockState();
    jest.clearAllMocks();
  });

  test('admin routes enforce authentication, admin role (403 for non-admin), CSRF, and 4 sidebar nav links', async () => {
    const admin = await seedUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const regular = await seedUser({ name: 'Regular User', email: 'user@test.com', role: 'user' });

    for (const path of ['/admin/users', '/admin/skills', '/admin/sessions', '/admin/settings', '/admin/reports']) {
      expect((await request(app).get(path)).statusCode).toBe(302);
    }

    const userAgent = await loginAgent(regular.email);
    const userCsrf = extractCsrfToken((await userAgent.get('/suggestions')).text);

    for (const path of ['/admin/users', '/admin/skills', '/admin/sessions', '/admin/settings', '/admin/reports']) {
      expect((await userAgent.get(path)).statusCode).toBe(403);
    }
    expect(
      (
        await userAgent
          .post(`/admin/users/${regular.id}/points-adjustment`)
          .type('form')
          .send({ _csrf: userCsrf, amount: 50 })
      ).statusCode
    ).toBe(403);
    expect(
      (
        await userAgent
          .post('/admin/skills')
          .type('form')
          .send({ _csrf: userCsrf, skillName: 'Go' })
      ).statusCode
    ).toBe(403);
    expect(
      (
        await userAgent
          .post('/admin/settings/general')
          .type('form')
          .send({
            _csrf: userCsrf,
            platformName: 'Hacked',
            platformEmail: 'h@test.com',
            platformDescription: 'Nope',
          })
      ).statusCode
    ).toBe(403);

    const adminAgent = await loginAgent(admin.email);
    const usersPage = await adminAgent.get('/admin/users');
    expect(usersPage.statusCode).toBe(200);
    // Sidebar has the 4 requested links
    expect(usersPage.text).toContain('href="/admin/users"');
    expect(usersPage.text).toContain('href="/admin/skills"');
    expect(usersPage.text).toContain('href="/admin/sessions"');
    expect(usersPage.text).toContain('href="/admin/settings"');
    // Missing CSRF on admin POST -> 403
    expect(
      (
        await adminAgent
          .post(`/admin/users/${regular.id}/points-adjustment`)
          .type('form')
          .send({ amount: 10 })
      ).statusCode
    ).toBe(403);
  });

  test('admin users page renders HTML cards, Overview SVG graph, user actions & suspend/reactivate flow', async () => {
    const admin = await seedUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin', pointsBalance: 20 });
    const alice = await seedUser({ name: 'Alice Active', email: 'alice@test.com', pointsBalance: 50 });

    const adminAgent = await loginAgent(admin.email);
    const page = await adminAgent.get('/admin/users');
    expect(page.statusCode).toBe(200);
    expect(page.text).toContain('Overview');
    expect(page.text).toContain('Learner');
    expect(page.text).toContain('Teacher');
    expect(page.text).toContain('data-purpose="overview-graph"');
    expect(page.text).toContain('Alice Active');
    expect(page.text).toContain('70'); // total points metric card (20 + 50)
    const csrf = extractCsrfToken(page.text);

    const selfSuspend = await adminAgent
      .post(`/admin/users/${admin.id}/suspend`)
      .type('form')
      .send({ _csrf: csrf });
    expect(selfSuspend.statusCode).toBe(400);
    expect(selfSuspend.text).toContain('cannot suspend your own account');

    const suspendRes = await adminAgent
      .post(`/admin/users/${alice.id}/suspend`)
      .type('form')
      .send({ _csrf: csrf });
    expect(suspendRes.statusCode).toBe(302);
    expect(mockState.users.find((u) => u.id === alice.id).status).toBe('suspended');

    const aliceAgent = request.agent(app);
    const aliceCsrf = extractCsrfToken((await aliceAgent.get('/login')).text);
    const blockedLogin = await aliceAgent.post('/login').type('form').send({
      _csrf: aliceCsrf,
      email: alice.email,
      password: 'Password123!',
    });
    expect(blockedLogin.statusCode).toBe(403);

    const reactivateRes = await adminAgent
      .post(`/admin/users/${alice.id}/reactivate`)
      .type('form')
      .send({ _csrf: csrf });
    expect(reactivateRes.statusCode).toBe(302);
    expect(mockState.users.find((u) => u.id === alice.id).status).toBe('active');
  });

  test('POST /admin/users/:id/points-adjustment validates signed ints, locks row, prevents <0 balance, and preserves sum invariant', async () => {
    const admin = await seedUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const alice = await seedUser({
      name: 'Alice Points',
      email: 'alicep@test.com',
      pointsBalance: 20,
    });

    const adminAgent = await loginAgent(admin.email);
    const page = await adminAgent.get('/admin/users');
    expect(page.statusCode).toBe(200);
    expect(page.text).toContain(`/admin/users/${alice.id}/points-adjustment`);
    const csrf = extractCsrfToken(page.text);

    const zeroRes = await adminAgent
      .post(`/admin/users/${alice.id}/points-adjustment`)
      .type('form')
      .send({ _csrf: csrf, amount: '0' });
    expect(zeroRes.statusCode).toBe(400);
    expect(zeroRes.text).toContain('non-zero integer');

    const floatRes = await adminAgent
      .post(`/admin/users/${alice.id}/points-adjustment`)
      .type('form')
      .send({ _csrf: csrf, amount: '5.5' });
    expect(floatRes.statusCode).toBe(400);
    expect(floatRes.text).toContain('whole number');

    const addRes = await adminAgent
      .post(`/admin/users/${alice.id}/points-adjustment`)
      .type('form')
      .send({ _csrf: csrf, amount: '15' });
    expect(addRes.statusCode).toBe(302);
    expect(mockState.users.find((u) => u.id === alice.id).pointsBalance).toBe(35);
    expect(computeBalanceFromTransactions(alice.id)).toBe(35);

    expect(
      mockState.rawQueries.some((q) => q.includes('FROM users') && q.includes('FOR UPDATE'))
    ).toBe(true);

    const subRes = await adminAgent
      .post(`/admin/users/${alice.id}/points-adjustment`)
      .type('form')
      .send({ _csrf: csrf, amount: '-10' });
    expect(subRes.statusCode).toBe(302);
    expect(mockState.users.find((u) => u.id === alice.id).pointsBalance).toBe(25);
    expect(computeBalanceFromTransactions(alice.id)).toBe(25);

    const txCountBefore = mockState.pointsTransactions.length;
    const overDeductRes = await adminAgent
      .post(`/admin/users/${alice.id}/points-adjustment`)
      .type('form')
      .send({ _csrf: csrf, amount: '-30' });
    expect(overDeductRes.statusCode).toBe(400);
    expect(overDeductRes.text).toContain('cannot go below 0');
    expect(mockState.users.find((u) => u.id === alice.id).pointsBalance).toBe(25);
    expect(mockState.pointsTransactions.length).toBe(txCountBefore);
    expect(computeBalanceFromTransactions(alice.id)).toBe(25);
  });

  test('admin skills page allows adding approved skills, approving/rejecting pending skills, and removing unused skills', async () => {
    const admin = await seedUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const learner = await seedUser({ name: 'Lina Learner', email: 'lina@test.com' });
    const teacher = await seedUser({ name: 'Tarek Teacher', email: 'tarek@test.com' });

    const pendingA = { id: mockState.nextIds.skill++, skillName: 'Rust', status: 'pending' };
    const inUseSkill = { id: mockState.nextIds.skill++, skillName: 'Python Programming', status: 'approved' };
    mockState.skills.push(pendingA, inUseSkill);
    mockState.sessions.push({
      id: mockState.nextIds.session++,
      swapRequestId: 1,
      instructorId: teacher.id,
      learnerId: learner.id,
      skillId: inUseSkill.id,
      dateTime: new Date('2026-12-01T10:00:00Z'),
      status: 'scheduled',
    });

    const adminAgent = await loginAgent(admin.email);
    const skillsPage = await adminAgent.get('/admin/skills');
    expect(skillsPage.statusCode).toBe(200);
    expect(skillsPage.text).toContain('action="/admin/skills"');
    const csrf = extractCsrfToken(skillsPage.text);

    // Add a new approved skill
    const addSkillRes = await adminAgent
      .post('/admin/skills')
      .type('form')
      .send({ _csrf: csrf, skillName: 'GraphQL APIs' });
    expect(addSkillRes.statusCode).toBe(302);
    const addedSkill = mockState.skills.find((s) => s.skillName === 'GraphQL APIs');
    expect(addedSkill).toBeTruthy();
    expect(addedSkill.status).toBe('approved');

    // Duplicate case-insensitive skill rejected -> 400
    const dupSkillRes = await adminAgent
      .post('/admin/skills')
      .type('form')
      .send({ _csrf: csrf, skillName: 'graphql apis' });
    expect(dupSkillRes.statusCode).toBe(400);
    expect(dupSkillRes.text).toContain('already exists');

    // Approve pending skill
    expect(
      (
        await adminAgent
          .post(`/admin/skills/${pendingA.id}/approve`)
          .type('form')
          .send({ _csrf: csrf })
      ).statusCode
    ).toBe(302);
    expect(pendingA.status).toBe('approved');

    // Cannot remove skill referenced by sessions -> 400
    const removeUsedRes = await adminAgent
      .post(`/admin/skills/${inUseSkill.id}/delete`)
      .type('form')
      .send({ _csrf: csrf });
    expect(removeUsedRes.statusCode).toBe(400);
    expect(removeUsedRes.text).toContain('Cannot remove a skill');
    expect(mockState.skills.some((s) => s.id === inUseSkill.id)).toBe(true);

    // Remove unused skill -> succeeds
    const removeUnusedRes = await adminAgent
      .post(`/admin/skills/${addedSkill.id}/delete`)
      .type('form')
      .send({ _csrf: csrf });
    expect(removeUnusedRes.statusCode).toBe(302);
    expect(mockState.skills.some((s) => s.id === addedSkill.id)).toBe(false);
  });

  test('admin sessions page renders read-only session records without per-row actions', async () => {
    const admin = await seedUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const learner = await seedUser({ name: 'Mona Ali', email: 'mona@test.com' });
    const teacher = await seedUser({ name: 'Sarah Ahmed', email: 'sarah@test.com' });
    const skill = { id: mockState.nextIds.skill++, skillName: 'UI/UX Design', status: 'approved' };
    mockState.skills.push(skill);

    const swapReq = {
      id: mockState.nextIds.swapRequest++,
      senderId: learner.id,
      receiverId: teacher.id,
      wantedSkillId: skill.id,
      offeredSkillId: null,
      status: 'accepted',
    };
    mockState.swapRequests.push(swapReq);

    mockState.sessions.push({
      id: mockState.nextIds.session++,
      swapRequestId: swapReq.id,
      instructorId: teacher.id,
      learnerId: learner.id,
      skillId: skill.id,
      dateTime: new Date('2026-11-23T10:00:00Z'),
      status: 'completed',
    });

    const adminAgent = await loginAgent(admin.email);
    const sessionsPage = await adminAgent.get('/admin/sessions');
    expect(sessionsPage.statusCode).toBe(200);
    expect(sessionsPage.text).toContain('Session Management');
    expect(sessionsPage.text).toContain('UI/UX Design');
    expect(sessionsPage.text).toContain('Mona Ali');
    expect(sessionsPage.text).toContain('Sarah Ahmed');
    expect(sessionsPage.text).toContain('Completed');
    // Ensure table header has no Actions column and rows have no per-row complete/cancel buttons
    expect(sessionsPage.text).not.toContain('Actions</th>');
    expect(sessionsPage.text).not.toContain('/complete');
    expect(sessionsPage.text).not.toContain('/cancel');
  });

  test('admin settings forms persist General Information and enforce Platform Preferences (registrations, email verification, maintenance mode)', async () => {
    const admin = await seedUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const regular = await seedUser({ name: 'Nour User', email: 'nour@test.com', role: 'user' });

    const adminAgent = await loginAgent(admin.email);
    const settingsPage = await adminAgent.get('/admin/settings');
    expect(settingsPage.statusCode).toBe(200);
    const csrf = extractCsrfToken(settingsPage.text);

    // 1. General Information update reflects in page titles and branding
    const generalRes = await adminAgent
      .post('/admin/settings/general')
      .type('form')
      .send({
        _csrf: csrf,
        platformName: 'LearnHub',
        platformEmail: 'help@learnhub.local',
        platformDescription: 'Peer exchange studio',
      });
    expect(generalRes.statusCode).toBe(302);
    expect(mockState.platformSettings.platformName).toBe('LearnHub');

    const welcomeRes = await request(app).get('/');
    expect(welcomeRes.statusCode).toBe(200);
    expect(welcomeRes.text).toContain('LearnHub');
    expect(welcomeRes.text).toContain('Peer exchange studio');

    // 2. Disable registrations (allowRegistrations omitted -> false)
    const disableRegRes = await adminAgent
      .post('/admin/settings/preferences')
      .type('form')
      .send({ _csrf: csrf });
    expect(disableRegRes.statusCode).toBe(302);
    expect(mockState.platformSettings.allowRegistrations).toBe(false);

    const guestAgent = request.agent(app);
    const regPage = await guestAgent.get('/register');
    expect(regPage.text).toContain('currently closed');
    const regCsrf = extractCsrfToken(regPage.text);
    const blockedReg = await guestAgent.post('/register').type('form').send({
      _csrf: regCsrf,
      firstName: 'Test',
      lastName: 'Blocked',
      email: 'blocked@test.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(blockedReg.statusCode).toBe(403);
    expect(blockedReg.text).toContain('currently disabled');

    // 3. Re-enable registrations + enable Require Email Verification
    const enableVerifRes = await adminAgent
      .post('/admin/settings/preferences')
      .type('form')
      .send({
        _csrf: csrf,
        allowRegistrations: 'true',
        requireEmailVerification: 'true',
      });
    expect(enableVerifRes.statusCode).toBe(302);
    expect(mockState.platformSettings.requireEmailVerification).toBe(true);

    const signupPage = await guestAgent.get('/register');
    const signupCsrf = extractCsrfToken(signupPage.text);
    const signupPost = await guestAgent.post('/register').type('form').send({
      _csrf: signupCsrf,
      firstName: 'Verified',
      lastName: 'Member',
      email: 'verifyme@test.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(signupPost.statusCode).toBe(302);
    expect(signupPost.headers.location).toBe('/verify-email');

    const verifyPage = await guestAgent.get('/verify-email');
    expect(verifyPage.statusCode).toBe(200);
    expect(verifyPage.text).toContain('verifyme@test.com');
    const verifyCsrf = extractCsrfToken(verifyPage.text);
    const tokenMatch = verifyPage.text.match(/name="token" value="([a-f0-9]+)"/);
    expect(tokenMatch).toBeTruthy();

    const badVerify = await guestAgent.post('/verify-email').type('form').send({
      _csrf: verifyCsrf,
      token: 'wrong-code',
    });
    expect(badVerify.statusCode).toBe(400);

    const goodVerify = await guestAgent.post('/verify-email').type('form').send({
      _csrf: verifyCsrf,
      token: tokenMatch[1],
    });
    expect(goodVerify.statusCode).toBe(302);
    expect(goodVerify.headers.location).toBe('/welcome');

    // 4. Enable Maintenance Mode -> regular users receive 503, admin retains access
    const maintOnRes = await adminAgent
      .post('/admin/settings/preferences')
      .type('form')
      .send({
        _csrf: csrf,
        allowRegistrations: 'true',
        maintenanceMode: 'true',
      });
    expect(maintOnRes.statusCode).toBe(302);
    expect(mockState.platformSettings.maintenanceMode).toBe(true);

    const userAgent = await loginAgent(regular.email);
    const blockedByMaint = await userAgent.get('/suggestions');
    expect(blockedByMaint.statusCode).toBe(503);
    expect(blockedByMaint.text).toContain('scheduled maintenance');

    // Admin still has access to /admin/settings and can disable maintenance mode
    const adminCheck = await adminAgent.get('/admin/settings');
    expect(adminCheck.statusCode).toBe(200);
  });

  test('reports endpoint remains functional and error handler renders friendly 404/500 pages', async () => {
    const admin = await seedUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const reporter = await seedUser({ name: 'Nour Reporter', email: 'nourr@test.com' });
    const rep = {
      id: mockState.nextIds.report++,
      submitterId: reporter.id,
      reportedUserId: null,
      type: 'bug',
      subject: 'Login typo',
      description: 'Minor spacing typo on login subtitle.',
      status: 'open',
      createdAt: new Date(),
    };
    mockState.reports.push(rep);

    const adminAgent = await loginAgent(admin.email);
    const reportsPage = await adminAgent.get('/admin/reports');
    expect(reportsPage.statusCode).toBe(200);
    const csrf = extractCsrfToken(reportsPage.text);

    const statusRes = await adminAgent
      .post(`/admin/reports/${rep.id}/status`)
      .type('form')
      .send({ _csrf: csrf, status: 'resolved' });
    expect(statusRes.statusCode).toBe(302);
    expect(rep.status).toBe('resolved');

    const notFoundRes = await request(app).get('/this-route-does-not-exist-phase8');
    expect(notFoundRes.statusCode).toBe(404);
    expect(notFoundRes.text).toContain('404');

    const miniApp = express();
    miniApp.set('views', require('path').join(__dirname, '..', 'src', 'views'));
    miniApp.set('view engine', 'pug');
    miniApp.use((_req, res, next) => {
      res.locals.currentUser = null;
      res.locals.csrfToken = null;
      res.locals.flash = { error: [], success: [], info: [] };
      next();
    });
    miniApp.get('/boom', () => {
      throw new Error('SECRET_DB_STACK_DETAIL_DO_NOT_LEAK');
    });
    miniApp.use(errorHandler);

    const res500 = await request(miniApp).get('/boom');
    expect(res500.statusCode).toBe(500);
    expect(res500.text).toContain('500');
    expect(res500.text).not.toContain('SECRET_DB_STACK_DETAIL_DO_NOT_LEAK');
  });

  test('all admin tables render search inputs and support server-side query and status filtering', async () => {
    const admin = await seedUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const alice = await seedUser({ name: 'Alice Zebra', email: 'alice@test.com', status: 'active' });
    const bob = await seedUser({ name: 'Bob Suspended', email: 'bob@test.com', status: 'suspended' });

    const pythonSkill = { id: mockState.nextIds.skill++, skillName: 'Python Programming', status: 'approved' };
    const rustSkill = { id: mockState.nextIds.skill++, skillName: 'Rust Systems', status: 'pending' };
    mockState.skills.push(pythonSkill, rustSkill);

    const reqOne = {
      id: mockState.nextIds.swapRequest++,
      senderId: alice.id,
      receiverId: bob.id,
      wantedSkillId: pythonSkill.id,
      offeredSkillId: null,
      status: 'accepted',
    };
    mockState.swapRequests.push(reqOne);
    mockState.sessions.push(
      {
        id: mockState.nextIds.session++,
        swapRequestId: reqOne.id,
        instructorId: bob.id,
        learnerId: alice.id,
        skillId: pythonSkill.id,
        dateTime: new Date('2026-11-23T10:00:00Z'),
        status: 'completed',
      },
      {
        id: mockState.nextIds.session++,
        swapRequestId: reqOne.id,
        instructorId: alice.id,
        learnerId: admin.id,
        skillId: rustSkill.id,
        dateTime: new Date('2026-12-05T14:00:00Z'),
        status: 'scheduled',
      }
    );

    mockState.reports.push(
      {
        id: mockState.nextIds.report++,
        submitterId: alice.id,
        reportedUserId: bob.id,
        type: 'user',
        subject: 'No show issue',
        description: 'Missed session',
        status: 'open',
        createdAt: new Date(),
      },
      {
        id: mockState.nextIds.report++,
        submitterId: bob.id,
        reportedUserId: null,
        type: 'bug',
        subject: 'Dark mode glitch',
        description: 'Layout overlap',
        status: 'resolved',
        createdAt: new Date(),
      }
    );

    const adminAgent = await loginAgent(admin.email);

    // Users table search by q and status
    const usersSearch = await adminAgent.get('/admin/users?q=Zebra&status=active');
    expect(usersSearch.statusCode).toBe(200);
    expect(usersSearch.text).toContain('data-table-search-target="adminUsersTable"');
    expect(usersSearch.text).toContain('/js/adminSearch.js');
    expect(usersSearch.text).toContain('Alice Zebra');
    expect(usersSearch.text).not.toContain('bob@test.com');

    // Skills table search by q and status
    const skillsSearch = await adminAgent.get('/admin/skills?q=Rust&status=pending');
    expect(skillsSearch.statusCode).toBe(200);
    expect(skillsSearch.text).toContain('data-table-search-target="adminSkillsTable"');
    expect(skillsSearch.text).toContain('/js/adminSearch.js');
    expect(skillsSearch.text).toContain('Rust Systems');
    expect(skillsSearch.text).not.toContain('Python Programming');

    // Sessions table search by q and status
    const sessionsSearch = await adminAgent.get('/admin/sessions?q=Rust&status=scheduled');
    expect(sessionsSearch.statusCode).toBe(200);
    expect(sessionsSearch.text).toContain('data-table-search-target="adminSessionsTable"');
    expect(sessionsSearch.text).toContain('/js/adminSearch.js');
    expect(sessionsSearch.text).toContain('Rust Systems');
    expect(sessionsSearch.text).not.toContain('Python Programming');

    // Reports table search by q and status
    const reportsSearch = await adminAgent.get('/admin/reports?q=glitch&status=resolved');
    expect(reportsSearch.statusCode).toBe(200);
    expect(reportsSearch.text).toContain('data-table-search-target="adminReportsTable"');
    expect(reportsSearch.text).toContain('/js/adminSearch.js');
    expect(reportsSearch.text).toContain('Dark mode glitch');
    expect(reportsSearch.text).not.toContain('No show issue');
  });
});
