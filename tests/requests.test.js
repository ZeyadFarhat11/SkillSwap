const request = require('supertest');
const bcrypt = require('bcrypt');

const mockState = {
  users: [],
  skills: [],
  userSkills: [],
  availability: [],
  swapRequests: [],
  sessions: [],
  pointsTransactions: [],
  rawQueries: [],
  nextIds: {
    user: 1,
    skill: 1,
    userSkill: 1,
    availability: 1,
    swapRequest: 1,
    session: 1,
    pointsTx: 1,
  },
};

function resetMockState() {
  mockState.users.length = 0;
  mockState.skills.length = 0;
  mockState.userSkills.length = 0;
  mockState.availability.length = 0;
  mockState.swapRequests.length = 0;
  mockState.sessions.length = 0;
  mockState.pointsTransactions.length = 0;
  mockState.rawQueries.length = 0;
  mockState.nextIds = {
    user: 1,
    skill: 1,
    userSkill: 1,
    availability: 1,
    swapRequest: 1,
    session: 1,
    pointsTx: 1,
  };
}

function mockHydrateSessionBase(sess) {
  if (!sess) return null;
  return {
    ...sess,
    instructor: mockState.users.find((u) => u.id === sess.instructorId) || null,
    learner: mockState.users.find((u) => u.id === sess.learnerId) || null,
    skill: mockState.skills.find((s) => s.id === sess.skillId) || null,
  };
}

function mockHydrateSwapRequest(sr) {
  if (!sr) return null;
  return {
    ...sr,
    sender: mockState.users.find((u) => u.id === sr.senderId) || null,
    receiver: mockState.users.find((u) => u.id === sr.receiverId) || null,
    wantedSkill: mockState.skills.find((s) => s.id === sr.wantedSkillId) || null,
    offeredSkill: sr.offeredSkillId
      ? mockState.skills.find((s) => s.id === sr.offeredSkillId)
      : null,
    sessions: mockState.sessions
      .filter((sess) => sess.swapRequestId === sr.id)
      .map(mockHydrateSessionBase),
  };
}

function mockHydrateSession(sess) {
  if (!sess) return null;
  const sr = mockState.swapRequests.find((r) => r.id === sess.swapRequestId);
  return {
    ...sess,
    swapRequest: sr ? mockHydrateSwapRequest(sr) : null,
    instructor: mockState.users.find((u) => u.id === sess.instructorId) || null,
    learner: mockState.users.find((u) => u.id === sess.learnerId) || null,
    skill: mockState.skills.find((s) => s.id === sess.skillId) || null,
    ratings: [],
  };
}

function mockHydrateUserProfile(user) {
  if (!user) return null;
  return {
    ...user,
    projectLinks: [],
    userSkills: mockState.userSkills
      .filter((us) => us.userId === user.id)
      .map((us) => ({ ...us, skill: mockState.skills.find((s) => s.id === us.skillId) }))
      .filter((us) => us.skill && us.skill.status === 'approved'),
    availability: mockState.availability.filter((a) => a.userId === user.id),
  };
}

function mockApplyUserUpdate(user, data) {
  if (data.pointsBalance !== undefined) {
    if (typeof data.pointsBalance === 'object') {
      if (data.pointsBalance.increment) user.pointsBalance += data.pointsBalance.increment;
      if (data.pointsBalance.decrement) user.pointsBalance -= data.pointsBalance.decrement;
    } else {
      user.pointsBalance = data.pointsBalance;
    }
  }
  Object.keys(data).forEach((key) => {
    if (key !== 'pointsBalance') user[key] = data[key];
  });
}

jest.mock('../src/models/prisma', () => ({
  user: {
    findUnique: jest.fn(async ({ where, include }) => {
      const found = mockState.users.find((u) =>
        where.email !== undefined ? u.email === where.email : u.id === where.id
      );
      if (!found) return null;
      return include ? mockHydrateUserProfile(found) : { ...found };
    }),
    findMany: jest.fn(async ({ where }) => {
      return mockState.users
        .filter((u) => {
          if (where?.id?.not !== undefined && u.id === where.id.not) return false;
          if (where?.status !== undefined && u.status !== where.status) return false;
          if (where?.userSkills?.some) {
            const someCond = where.userSkills.some;
            const offers = mockState.userSkills.some((us) => {
              if (us.userId !== u.id) return false;
              if (someCond.type && us.type !== someCond.type) return false;
              const sk = mockState.skills.find((s) => s.id === us.skillId);
              return Boolean(sk && (!someCond.skill?.status || sk.status === someCond.skill.status));
            });
            if (!offers) return false;
          }
          return true;
        })
        .map((u) => ({
          ...u,
          userSkills: mockState.userSkills
            .filter((us) => us.userId === u.id)
            .map((us) => ({ ...us, skill: mockState.skills.find((s) => s.id === us.skillId) }))
            .filter((us) => us.skill && us.skill.status === 'approved'),
          receivedRatings: [],
        }));
    }),
    update: jest.fn(async ({ where, data }) => {
      const user = mockState.users.find((u) => u.id === where.id);
      if (!user) throw new Error('User not found');
      mockApplyUserUpdate(user, data);
      return { ...user };
    }),
  },
  userSkill: {
    findFirst: jest.fn(async ({ where, include }) => {
      const found = mockState.userSkills.find((us) => {
        if (where.userId !== undefined && us.userId !== where.userId) return false;
        if (where.skillId !== undefined && us.skillId !== where.skillId) return false;
        if (where.type !== undefined && us.type !== where.type) return false;
        if (where.skill?.status) {
          const sk = mockState.skills.find((s) => s.id === us.skillId);
          if (!sk || sk.status !== where.skill.status) return false;
        }
        return true;
      });
      if (!found) return null;
      if (include?.skill) {
        return { ...found, skill: mockState.skills.find((s) => s.id === found.skillId) };
      }
      return { ...found };
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.userSkills
        .filter((us) => {
          if (where.userId !== undefined && us.userId !== where.userId) return false;
          if (where.skillId !== undefined && us.skillId !== where.skillId) return false;
          if (where.skill?.status) {
            const sk = mockState.skills.find((s) => s.id === us.skillId);
            if (!sk || sk.status !== where.skill.status) return false;
          }
          return true;
        })
        .map((us) => ({
          ...us,
          skill: mockState.skills.find((s) => s.id === us.skillId),
        }))
    ),
  },
  skill: {
    findMany: jest.fn(async () => mockState.skills.filter((s) => s.status === 'approved')),
  },
  availability: {
    findMany: jest.fn(async ({ where }) =>
      mockState.availability.filter((a) => {
        if (where.userId !== undefined && a.userId !== where.userId) return false;
        return true;
      })
    ),
  },
  swapRequest: {
    create: jest.fn(async ({ data }) => {
      const created = {
        id: mockState.nextIds.swapRequest++,
        ...data,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockState.swapRequests.push(created);
      return mockHydrateSwapRequest(created);
    }),
    findFirst: jest.fn(async ({ where }) => {
      const found = mockState.swapRequests.find((sr) => {
        if (where.senderId !== undefined && sr.senderId !== where.senderId) return false;
        if (where.receiverId !== undefined && sr.receiverId !== where.receiverId) return false;
        if (where.wantedSkillId !== undefined && sr.wantedSkillId !== where.wantedSkillId) return false;
        if (where.offeredSkillId !== undefined && sr.offeredSkillId !== where.offeredSkillId) return false;
        if (where.status !== undefined && sr.status !== where.status) return false;
        return true;
      });
      return found ? mockHydrateSwapRequest(found) : null;
    }),
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.swapRequests.find((sr) => sr.id === where.id);
      return found ? mockHydrateSwapRequest(found) : null;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.swapRequests
        .filter((sr) => {
          if (where?.status !== undefined && sr.status !== where.status) return false;
          if (where?.OR) {
            return where.OR.some((cond) => {
              if (cond.senderId !== undefined && sr.senderId === cond.senderId) return true;
              if (cond.receiverId !== undefined && sr.receiverId === cond.receiverId) return true;
              return false;
            });
          }
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(mockHydrateSwapRequest)
    ),
    count: jest.fn(async ({ where }) =>
      mockState.swapRequests.filter((sr) => {
        if (where?.status !== undefined && sr.status !== where.status) return false;
        if (where?.OR) {
          return where.OR.some((cond) => {
            if (cond.senderId !== undefined && sr.senderId === cond.senderId) return true;
            if (cond.receiverId !== undefined && sr.receiverId === cond.receiverId) return true;
            return false;
          });
        }
        return true;
      }).length
    ),
    update: jest.fn(async ({ where, data }) => {
      const sr = mockState.swapRequests.find((r) => r.id === where.id);
      if (!sr) throw new Error('Not found');
      Object.assign(sr, data, { updatedAt: new Date() });
      return mockHydrateSwapRequest(sr);
    }),
  },
  session: {
    create: jest.fn(async ({ data }) => {
      const created = {
        id: mockState.nextIds.session++,
        ...data,
        status: 'scheduled',
        summary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockState.sessions.push(created);
      return mockHydrateSession(created);
    }),
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.sessions.find((s) => s.id === where.id);
      return found ? mockHydrateSession(found) : null;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.sessions
        .filter((s) => {
          if (where?.swapRequestId !== undefined && s.swapRequestId !== where.swapRequestId) {
            return false;
          }
          if (where?.status?.in && !where.status.in.includes(s.status)) {
            return false;
          }
          if (where?.OR) {
            return where.OR.some((cond) => {
              if (cond.instructorId !== undefined && s.instructorId === cond.instructorId) return true;
              if (cond.learnerId !== undefined && s.learnerId === cond.learnerId) return true;
              return false;
            });
          }
          return true;
        })
        .map(mockHydrateSession)
    ),
    update: jest.fn(async ({ where, data }) => {
      const sess = mockState.sessions.find((s) => s.id === where.id);
      if (!sess) throw new Error('Not found');
      Object.assign(sess, data, { updatedAt: new Date() });
      return mockHydrateSession(sess);
    }),
  },
  pointsTransaction: {
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockState.pointsTransactions.push({
          id: mockState.nextIds.pointsTx++,
          ...item,
          createdAt: new Date(),
        });
      }
      return { count: data.length };
    }),
    create: jest.fn(async ({ data }) => {
      const created = {
        id: mockState.nextIds.pointsTx++,
        ...data,
        createdAt: new Date(),
      };
      mockState.pointsTransactions.push(created);
      return created;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.pointsTransactions.filter((pt) => {
        if (where.userId !== undefined && pt.userId !== where.userId) return false;
        return true;
      })
    ),
  },
  $transaction: jest.fn(async (cbOrArray) => {
    if (typeof cbOrArray === 'function') {
      // Snapshot rollback support for transaction failures
      const snapshotUsers = mockState.users.map((u) => ({ ...u }));
      const snapshotSessions = mockState.sessions.map((s) => ({ ...s }));
      const snapshotRequests = mockState.swapRequests.map((r) => ({ ...r }));
      const snapshotTxns = mockState.pointsTransactions.map((t) => ({ ...t }));

      const mockTx = {
        $queryRaw: jest.fn(async (strings, ...values) => {
          const sqlText = Array.isArray(strings) ? strings.join('?') : String(strings);
          mockState.rawQueries.push(sqlText);
          const ids = values.map(Number).filter((v) => !Number.isNaN(v));

          if (sqlText.includes('FROM sessions')) {
            return mockState.sessions
              .filter((s) => ids.includes(s.id))
              .map((s) => ({
                id: s.id,
                swap_request_id: s.swapRequestId,
                instructor_id: s.instructorId,
                learner_id: s.learnerId,
                status: s.status,
                date_time: s.dateTime,
              }));
          }

          if (sqlText.includes('FROM users')) {
            return mockState.users
              .filter((u) => ids.includes(u.id))
              .sort((a, b) => a.id - b.id)
              .map((u) => ({ id: u.id, points_balance: u.pointsBalance }));
          }

          return [];
        }),
        session: {
          create: jest.fn(async ({ data }) => {
            const created = {
              id: mockState.nextIds.session++,
              ...data,
              status: 'scheduled',
              summary: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockState.sessions.push(created);
            return mockHydrateSession(created);
          }),
          findMany: jest.fn(async ({ where }) =>
            mockState.sessions
              .filter((s) => where?.swapRequestId === undefined || s.swapRequestId === where.swapRequestId)
              .map(mockHydrateSession)
          ),
          findUnique: jest.fn(async ({ where }) => {
            const found = mockState.sessions.find((s) => s.id === where.id);
            return found ? mockHydrateSession(found) : null;
          }),
          update: jest.fn(async ({ where, data }) => {
            const sess = mockState.sessions.find((s) => s.id === where.id);
            if (!sess) throw new Error('Not found');
            Object.assign(sess, data, { updatedAt: new Date() });
            return mockHydrateSession(sess);
          }),
        },
        swapRequest: {
          update: jest.fn(async ({ where, data }) => {
            const sr = mockState.swapRequests.find((r) => r.id === where.id);
            if (!sr) throw new Error('Not found');
            Object.assign(sr, data, { updatedAt: new Date() });
            return mockHydrateSwapRequest(sr);
          }),
        },
        user: {
          update: jest.fn(async ({ where, data }) => {
            const user = mockState.users.find((u) => u.id === where.id);
            if (!user) throw new Error('User not found');
            mockApplyUserUpdate(user, data);
            return { ...user };
          }),
        },
        pointsTransaction: {
          createMany: jest.fn(async ({ data }) => {
            for (const item of data) {
              mockState.pointsTransactions.push({
                id: mockState.nextIds.pointsTx++,
                ...item,
                createdAt: new Date(),
              });
            }
            return { count: data.length };
          }),
        },
      };

      try {
        return await cbOrArray(mockTx);
      } catch (err) {
        mockState.users.splice(0, mockState.users.length, ...snapshotUsers);
        mockState.sessions.splice(0, mockState.sessions.length, ...snapshotSessions);
        mockState.swapRequests.splice(0, mockState.swapRequests.length, ...snapshotRequests);
        mockState.pointsTransactions.splice(0, mockState.pointsTransactions.length, ...snapshotTxns);
        throw err;
      }
    }

    const results = [];
    for (const p of cbOrArray) {
      results.push(await p);
    }
    return results;
  }),
}));

const app = require('../src/app');
const { POINTS_PER_SESSION, STARTER_POINTS } = require('../src/config/constants');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"|value="([^"]+)"\s+name="_csrf"/);
  return match ? match[1] || match[2] : null;
}

async function seedUser({ name, email, pointsBalance = STARTER_POINTS, status = 'active' }) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = {
    id: mockState.nextIds.user++,
    name,
    email,
    passwordHash,
    role: 'user',
    status,
    bio: null,
    avatarPath: null,
    pointsBalance,
    createdAt: new Date(),
  };
  mockState.users.push(user);
  if (pointsBalance > 0) {
    mockState.pointsTransactions.push({
      id: mockState.nextIds.pointsTx++,
      userId: user.id,
      sessionId: null,
      type: 'bonus',
      amount: pointsBalance,
      createdAt: new Date(),
    });
  }
  return user;
}

function seedSkill(skillName, status = 'approved') {
  const skill = {
    id: mockState.nextIds.skill++,
    skillName,
    status,
    createdAt: new Date(),
  };
  mockState.skills.push(skill);
  return skill;
}

function seedUserSkill(userId, skillId, type, level = 'intermediate') {
  const us = {
    id: mockState.nextIds.userSkill++,
    userId,
    skillId,
    type,
    level,
    createdAt: new Date(),
  };
  mockState.userSkills.push(us);
  return us;
}

function seedAvailability(userId, dayOfWeek, startHour, endHour) {
  const slot = {
    id: mockState.nextIds.availability++,
    userId,
    dayOfWeek,
    startTime: new Date(Date.UTC(1970, 0, 1, startHour, 0, 0)),
    endTime: new Date(Date.UTC(1970, 0, 1, endHour, 0, 0)),
    createdAt: new Date(),
  };
  mockState.availability.push(slot);
  return slot;
}

function computeBalanceFromTransactions(userId) {
  return mockState.pointsTransactions
    .filter((pt) => pt.userId === userId)
    .reduce((sum, pt) => {
      if (pt.type === 'earn' || pt.type === 'bonus' || pt.type === 'adjustment') {
        return sum + pt.amount;
      }
      if (pt.type === 'spend') {
        return sum - pt.amount;
      }
      return sum;
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

async function getCsrf(agent, path = '/requests') {
  const page = await agent.get(path);
  return extractCsrfToken(page.text);
}

describe('Phase 5 Swap Requests, Sessions, and Transactional Points', () => {
  beforeEach(() => {
    resetMockState();
    jest.clearAllMocks();
  });

  test('POST /requests enforces CSRF, rejects self-requests, unoffered skills, and suspended receivers', async () => {
    const alice = await seedUser({ name: 'Alice', email: 'alice@test.com' });
    const bob = await seedUser({ name: 'Bob', email: 'bob@test.com' });
    const suspended = await seedUser({ name: 'Suspended', email: 'susp@test.com', status: 'suspended' });
    const python = seedSkill('Python');
    const rust = seedSkill('Rust', 'pending');

    seedUserSkill(alice.id, python.id, 'offer');
    seedUserSkill(bob.id, python.id, 'want'); // Bob does not offer Python
    seedUserSkill(suspended.id, python.id, 'offer');
    seedUserSkill(bob.id, rust.id, 'offer'); // Pending skill

    const agent = await loginAgent(alice.email);
    const csrf = await getCsrf(agent, '/requests');

    // Missing CSRF -> 403
    const noCsrf = await agent.post('/requests').type('form').send({
      receiverId: bob.id,
      wantedSkillId: python.id,
    });
    expect(noCsrf.statusCode).toBe(403);

    // Self-request -> 400
    const selfRes = await agent.post('/requests').type('form').send({
      _csrf: csrf,
      receiverId: alice.id,
      wantedSkillId: python.id,
    });
    expect(selfRes.statusCode).toBe(400);
    expect(selfRes.text).toContain('yourself');

    // Receiver does not offer wanted skill -> 400
    const notOffered = await agent.post('/requests').type('form').send({
      _csrf: csrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
    });
    expect(notOffered.statusCode).toBe(400);
    expect(notOffered.text).toContain('does not offer');

    // Unapproved skill rejected -> 400
    const unapproved = await agent.post('/requests').type('form').send({
      _csrf: csrf,
      receiverId: bob.id,
      wantedSkillId: rust.id,
    });
    expect(unapproved.statusCode).toBe(400);

    // Suspended receiver rejected -> 400
    const suspRes = await agent.post('/requests').type('form').send({
      _csrf: csrf,
      receiverId: suspended.id,
      wantedSkillId: python.id,
    });
    expect(suspRes.statusCode).toBe(400);
    expect(mockState.swapRequests).toHaveLength(0);
  });

  test('POST /requests rejects duplicate pending requests and enforces one-way balance check', async () => {
    const alice = await seedUser({ name: 'Alice', email: 'alice@test.com', pointsBalance: 5 });
    const bob = await seedUser({ name: 'Bob', email: 'bob@test.com', pointsBalance: 20 });
    const python = seedSkill('Python');
    const guitar = seedSkill('Guitar');
    seedUserSkill(bob.id, python.id, 'offer');
    seedUserSkill(alice.id, guitar.id, 'offer');

    const agent = await loginAgent(alice.email);
    const csrf = await getCsrf(agent, '/requests');

    // One-way request fails when balance < POINTS_PER_SESSION
    const lowBalanceRes = await agent.post('/requests').type('form').send({
      _csrf: csrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
    });
    expect(lowBalanceRes.statusCode).toBe(400);
    expect(lowBalanceRes.text).toContain(`${POINTS_PER_SESSION} points`);
    expect(mockState.swapRequests).toHaveLength(0);

    // Mutual swap succeeds even with < POINTS_PER_SESSION (5 points)
    const r1 = await agent.post('/requests').type('form').send({
      _csrf: csrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
      offeredSkillId: guitar.id,
    });
    expect(r1.statusCode).toBe(302);
    expect(r1.headers.location).toBe('/requests');
    expect(mockState.swapRequests).toHaveLength(1);

    // Duplicate pending request rejected -> 409
    const dupRes = await agent.post('/requests').type('form').send({
      _csrf: csrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
      offeredSkillId: guitar.id,
    });
    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.text).toContain('already have a pending request');
    expect(mockState.swapRequests).toHaveLength(1);
  });

  test('accept, decline, and cancel enforce ownership and pending state', async () => {
    const alice = await seedUser({ name: 'Alice', email: 'alice@test.com' });
    const bob = await seedUser({ name: 'Bob', email: 'bob@test.com' });
    const charlie = await seedUser({ name: 'Charlie', email: 'charlie@test.com' });
    const python = seedSkill('Python');
    seedUserSkill(bob.id, python.id, 'offer');

    const aliceAgent = await loginAgent(alice.email);
    const bobAgent = await loginAgent(bob.email);
    const charlieAgent = await loginAgent(charlie.email);

    const aliceCsrf = await getCsrf(aliceAgent, '/requests');
    const bobCsrf = await getCsrf(bobAgent, '/requests');
    const charlieCsrf = await getCsrf(charlieAgent, '/requests');

    // Request 1: test accept & non-pending rejection
    await aliceAgent.post('/requests').type('form').send({
      _csrf: aliceCsrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
    });
    const req1Id = mockState.swapRequests[0].id;

    // Sender & outsider cannot accept (403); receiver cannot cancel (403)
    expect(
      (await aliceAgent.post(`/requests/${req1Id}/accept`).type('form').send({ _csrf: aliceCsrf }))
        .statusCode
    ).toBe(403);
    expect(
      (await charlieAgent.post(`/requests/${req1Id}/accept`).type('form').send({ _csrf: charlieCsrf }))
        .statusCode
    ).toBe(403);
    expect(
      (await bobAgent.post(`/requests/${req1Id}/cancel`).type('form').send({ _csrf: bobCsrf }))
        .statusCode
    ).toBe(403);

    // Receiver accepts
    const acceptRes = await bobAgent
      .post(`/requests/${req1Id}/accept`)
      .type('form')
      .send({ _csrf: bobCsrf });
    expect(acceptRes.statusCode).toBe(302);
    expect(mockState.swapRequests[0].status).toBe('accepted');

    // Accepting or declining a non-pending request -> 400
    const repeatRes = await bobAgent
      .post(`/requests/${req1Id}/decline`)
      .type('form')
      .send({ _csrf: bobCsrf });
    expect(repeatRes.statusCode).toBe(400);

    // Request 2: sender cancels pending request
    await aliceAgent.post('/requests').type('form').send({
      _csrf: aliceCsrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
    });
    const req2Id = mockState.swapRequests[1].id;
    const cancelRes = await aliceAgent
      .post(`/requests/${req2Id}/cancel`)
      .type('form')
      .send({ _csrf: aliceCsrf });
    expect(cancelRes.statusCode).toBe(302);
    expect(mockState.swapRequests[1].status).toBe('cancelled');

    // Request 3: receiver declines pending request
    await aliceAgent.post('/requests').type('form').send({
      _csrf: aliceCsrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
    });
    const req3Id = mockState.swapRequests[2].id;
    const declineRes = await bobAgent
      .post(`/requests/${req3Id}/decline`)
      .type('form')
      .send({ _csrf: bobCsrf });
    expect(declineRes.statusCode).toBe(302);
    expect(mockState.swapRequests[2].status).toBe('declined');
  });

  test('POST /sessions schedules mutual swap (2 sessions) inside shared availability and blocks duplicates', async () => {
    const alice = await seedUser({ name: 'Alice', email: 'alice@test.com' });
    const bob = await seedUser({ name: 'Bob', email: 'bob@test.com' });
    const charlie = await seedUser({ name: 'Charlie', email: 'charlie@test.com' });
    const python = seedSkill('Python');
    const guitar = seedSkill('Guitar');
    seedUserSkill(bob.id, python.id, 'offer');
    seedUserSkill(alice.id, guitar.id, 'offer');

    // Wednesday (3): Alice 09-12 UTC, Bob 10-14 UTC => shared 10-12 UTC
    seedAvailability(alice.id, 3, 9, 12);
    seedAvailability(bob.id, 3, 10, 14);

    const aliceAgent = await loginAgent(alice.email);
    const bobAgent = await loginAgent(bob.email);
    const charlieAgent = await loginAgent(charlie.email);

    const aliceCsrf = await getCsrf(aliceAgent, '/requests');
    const bobCsrf = await getCsrf(bobAgent, '/requests');
    const charlieCsrf = await getCsrf(charlieAgent, '/sessions');

    await aliceAgent.post('/requests').type('form').send({
      _csrf: aliceCsrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
      offeredSkillId: guitar.id,
    });
    const reqId = mockState.swapRequests[0].id;

    // Cannot schedule before acceptance -> 400
    const beforeAccept = await aliceAgent.post('/sessions').type('form').send({
      _csrf: aliceCsrf,
      swapRequestId: reqId,
      dateTime: '2026-12-02T10:30',
    });
    expect(beforeAccept.statusCode).toBe(400);

    await bobAgent.post(`/requests/${reqId}/accept`).type('form').send({ _csrf: bobCsrf });

    // Non-participant cannot schedule -> 403
    const outsiderRes = await charlieAgent.post('/sessions').type('form').send({
      _csrf: charlieCsrf,
      swapRequestId: reqId,
      dateTime: '2026-12-02T10:30',
    });
    expect(outsiderRes.statusCode).toBe(403);

    // Outside receiver availability (09:30 is only in Alice's 09-12, not Bob's 10-14) -> 400
    const outsideRes = await aliceAgent.post('/sessions').type('form').send({
      _csrf: aliceCsrf,
      swapRequestId: reqId,
      dateTime: '2026-12-02T09:30',
    });
    expect(outsideRes.statusCode).toBe(400);
    expect(mockState.sessions).toHaveLength(0);

    // Valid naive datetime-local inside shared 10-12 UTC window -> 302, creates 2 sessions
    const okRes = await aliceAgent.post('/sessions').type('form').send({
      _csrf: aliceCsrf,
      swapRequestId: reqId,
      dateTime: '2026-12-02T10:30',
    });
    expect(okRes.statusCode).toBe(302);
    expect(okRes.headers.location).toBe('/sessions');
    expect(mockState.sessions).toHaveLength(2);

    // Duplicate scheduling on same accepted request rejected -> 409
    const dupSched = await aliceAgent.post('/sessions').type('form').send({
      _csrf: aliceCsrf,
      swapRequestId: reqId,
      dateTime: '2026-12-02T11:00',
    });
    expect(dupSched.statusCode).toBe(409);
    expect(mockState.sessions).toHaveLength(2);
  });

  test('session completion enforces date_time, row locks, atomic points transfer, and transaction sum invariant', async () => {
    const alice = await seedUser({ name: 'Alice Learner', email: 'alice@test.com', pointsBalance: 30 });
    const bob = await seedUser({ name: 'Bob Teacher', email: 'bob@test.com', pointsBalance: 15 });
    const charlie = await seedUser({ name: 'Charlie', email: 'charlie@test.com' });
    const python = seedSkill('Python');
    const sqlSkill = seedSkill('SQL');
    seedUserSkill(bob.id, python.id, 'offer');
    seedUserSkill(alice.id, sqlSkill.id, 'offer');
    seedAvailability(alice.id, 3, 10, 14);
    seedAvailability(bob.id, 3, 10, 14);

    const aliceAgent = await loginAgent(alice.email);
    const bobAgent = await loginAgent(bob.email);
    const charlieAgent = await loginAgent(charlie.email);
    const aliceCsrf = await getCsrf(aliceAgent, '/requests');
    const bobCsrf = await getCsrf(bobAgent, '/requests');
    const charlieCsrf = await getCsrf(charlieAgent, '/sessions');

    // One-way request #1 (scheduled in future first) -> cannot complete early
    await aliceAgent.post('/requests').type('form').send({
      _csrf: aliceCsrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
    });
    const req1Id = mockState.swapRequests[0].id;
    await bobAgent.post(`/requests/${req1Id}/accept`).type('form').send({ _csrf: bobCsrf });

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const daysToWed = (3 - futureDate.getUTCDay() + 7) % 7 || 7;
    const futureWed = new Date(
      Date.UTC(
        futureDate.getUTCFullYear(),
        futureDate.getUTCMonth(),
        futureDate.getUTCDate() + daysToWed,
        11,
        0,
        0
      )
    );

    await aliceAgent.post('/sessions').type('form').send({
      _csrf: aliceCsrf,
      swapRequestId: req1Id,
      dateTime: futureWed.toISOString(),
    });
    const futureSessId = mockState.sessions[0].id;

    // Cannot complete before scheduled time -> 400
    const earlyComplete = await bobAgent
      .post(`/sessions/${futureSessId}/complete`)
      .type('form')
      .send({ _csrf: bobCsrf });
    expect(earlyComplete.statusCode).toBe(400);
    expect(earlyComplete.text).toContain('before its scheduled time');
    expect(mockState.sessions[0].status).toBe('scheduled');

    // Cancel and reschedule in the past (Wednesday 2026-11-25 10:00 UTC)
    await aliceAgent.post(`/sessions/${futureSessId}/cancel`).type('form').send({ _csrf: aliceCsrf });
    expect(mockState.sessions[0].status).toBe('cancelled');

    const pastWed = '2026-11-25T10:00:00.000Z';
    const reSched = await aliceAgent.post('/sessions').type('form').send({
      _csrf: aliceCsrf,
      swapRequestId: req1Id,
      dateTime: pastWed,
    });
    expect(reSched.statusCode).toBe(302);
    const sess1Id = mockState.sessions[1].id;

    // Outsider cannot complete -> 403
    const outsiderComplete = await charlieAgent
      .post(`/sessions/${sess1Id}/complete`)
      .type('form')
      .send({ _csrf: charlieCsrf });
    expect(outsiderComplete.statusCode).toBe(403);

    // Complete one-way session -> transfers POINTS_PER_SESSION inside row-locked tx
    const okComplete = await bobAgent
      .post(`/sessions/${sess1Id}/complete`)
      .type('form')
      .send({ _csrf: bobCsrf });
    expect(okComplete.statusCode).toBe(302);
    expect(mockState.sessions[1].status).toBe('completed');
    expect(mockState.swapRequests[0].status).toBe('completed');

    // Verify SELECT ... FOR UPDATE row locks were executed inside transaction
    expect(mockState.rawQueries.some((q) => q.includes('FROM sessions') && q.includes('FOR UPDATE'))).toBe(true);
    expect(mockState.rawQueries.some((q) => q.includes('FROM users') && q.includes('FOR UPDATE'))).toBe(true);

    // Re-completing the same session rejected -> 400, no double spend
    const secondComplete = await aliceAgent
      .post(`/sessions/${sess1Id}/complete`)
      .type('form')
      .send({ _csrf: aliceCsrf });
    expect(secondComplete.statusCode).toBe(400);

    // Balance exact and matches transaction sum invariant
    expect(alice.pointsBalance).toBe(30 - POINTS_PER_SESSION);
    expect(bob.pointsBalance).toBe(15 + POINTS_PER_SESSION);
    expect(alice.pointsBalance).toBe(computeBalanceFromTransactions(alice.id));
    expect(bob.pointsBalance).toBe(computeBalanceFromTransactions(bob.id));

    // Request #2: test reverse direction (Bob learns SQL from Alice, mutual/one-way chaining)
    await bobAgent.post('/requests').type('form').send({
      _csrf: bobCsrf,
      receiverId: alice.id,
      wantedSkillId: sqlSkill.id,
    });
    const req2Id = mockState.swapRequests[1].id;
    await aliceAgent.post(`/requests/${req2Id}/accept`).type('form').send({ _csrf: aliceCsrf });
    await bobAgent.post('/sessions').type('form').send({
      _csrf: bobCsrf,
      swapRequestId: req2Id,
      dateTime: pastWed,
    });
    const sess2Id = mockState.sessions[2].id;
    await aliceAgent.post(`/sessions/${sess2Id}/complete`).type('form').send({ _csrf: aliceCsrf });

    // Multi-step invariant: Alice 30 - 10 + 10 = 30, Bob 15 + 10 - 10 = 15
    expect(alice.pointsBalance).toBe(30);
    expect(bob.pointsBalance).toBe(15);
    expect(alice.pointsBalance).toBe(computeBalanceFromTransactions(alice.id));
    expect(bob.pointsBalance).toBe(computeBalanceFromTransactions(bob.id));
  });

  test('completing one-way session rejects insufficient points inside locked transaction without mutating state', async () => {
    const alice = await seedUser({ name: 'Alice', email: 'alice@test.com', pointsBalance: 10 });
    const bob = await seedUser({ name: 'Bob', email: 'bob@test.com', pointsBalance: 20 });
    const python = seedSkill('Python');
    seedUserSkill(bob.id, python.id, 'offer');
    seedAvailability(alice.id, 3, 10, 12);
    seedAvailability(bob.id, 3, 10, 12);

    const aliceAgent = await loginAgent(alice.email);
    const bobAgent = await loginAgent(bob.email);
    const aliceCsrf = await getCsrf(aliceAgent, '/requests');
    const bobCsrf = await getCsrf(bobAgent, '/requests');

    await aliceAgent.post('/requests').type('form').send({
      _csrf: aliceCsrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
    });
    const reqId = mockState.swapRequests[0].id;
    await bobAgent.post(`/requests/${reqId}/accept`).type('form').send({ _csrf: bobCsrf });
    await aliceAgent.post('/sessions').type('form').send({
      _csrf: aliceCsrf,
      swapRequestId: reqId,
      dateTime: '2026-11-25T10:00:00.000Z',
    });
    const sessionId = mockState.sessions[0].id;

    // Simulate Alice's balance dropping before session completion (e.g. from another one-way completion)
    alice.pointsBalance = POINTS_PER_SESSION - 1;
    mockState.pointsTransactions.push({
      id: mockState.nextIds.pointsTx++,
      userId: alice.id,
      sessionId: null,
      type: 'spend',
      amount: 1,
      createdAt: new Date(),
    });
    const txCountBefore = mockState.pointsTransactions.length;

    const res = await bobAgent
      .post(`/sessions/${sessionId}/complete`)
      .type('form')
      .send({ _csrf: bobCsrf });
    expect(res.statusCode).toBe(400);
    expect(res.text).toContain('Insufficient points');

    // Rollback check: session still scheduled, request still accepted, no new txns, balances intact
    expect(mockState.sessions[0].status).toBe('scheduled');
    expect(mockState.swapRequests[0].status).toBe('accepted');
    expect(alice.pointsBalance).toBe(POINTS_PER_SESSION - 1);
    expect(bob.pointsBalance).toBe(20);
    expect(mockState.pointsTransactions.length).toBe(txCountBefore);
    expect(alice.pointsBalance).toBe(computeBalanceFromTransactions(alice.id));
    expect(bob.pointsBalance).toBe(computeBalanceFromTransactions(bob.id));
  });

  test('mutual swap completion transfers zero points and marks request completed only after both sessions finish', async () => {
    const alice = await seedUser({ name: 'Alice', email: 'alice@test.com', pointsBalance: 0 });
    const bob = await seedUser({ name: 'Bob', email: 'bob@test.com', pointsBalance: 0 });
    const python = seedSkill('Python');
    const guitar = seedSkill('Guitar');
    seedUserSkill(bob.id, python.id, 'offer');
    seedUserSkill(alice.id, guitar.id, 'offer');
    seedAvailability(alice.id, 3, 10, 12);
    seedAvailability(bob.id, 3, 10, 12);

    const aliceAgent = await loginAgent(alice.email);
    const bobAgent = await loginAgent(bob.email);
    const aliceCsrf = await getCsrf(aliceAgent, '/requests');
    const bobCsrf = await getCsrf(bobAgent, '/requests');

    await aliceAgent.post('/requests').type('form').send({
      _csrf: aliceCsrf,
      receiverId: bob.id,
      wantedSkillId: python.id,
      offeredSkillId: guitar.id,
    });
    const reqId = mockState.swapRequests[0].id;
    await bobAgent.post(`/requests/${reqId}/accept`).type('form').send({ _csrf: bobCsrf });
    await aliceAgent.post('/sessions').type('form').send({
      _csrf: aliceCsrf,
      swapRequestId: reqId,
      dateTime: '2026-11-25T10:00:00.000Z',
    });

    const [sess1, sess2] = mockState.sessions;

    await bobAgent.post(`/sessions/${sess1.id}/complete`).type('form').send({ _csrf: bobCsrf });
    expect(mockState.sessions[0].status).toBe('completed');
    expect(mockState.swapRequests[0].status).toBe('accepted'); // Not yet completed until sess2 finishes

    await aliceAgent.post(`/sessions/${sess2.id}/complete`).type('form').send({ _csrf: aliceCsrf });
    expect(mockState.sessions[1].status).toBe('completed');
    expect(mockState.swapRequests[0].status).toBe('completed');

    expect(alice.pointsBalance).toBe(0);
    expect(bob.pointsBalance).toBe(0);
    expect(mockState.pointsTransactions).toHaveLength(0);
  });

  test('GET /requests renders Swap With cards for active peers offering skills', async () => {
    const alice = await seedUser({ name: 'Alice Viewer', email: 'alicev@test.com' });
    const bob = await seedUser({ name: 'Bob Mentor', email: 'bobm@test.com' });
    const charlie = await seedUser({ name: 'Charlie WantOnly', email: 'charliew@test.com' });
    const suspended = await seedUser({ name: 'Susp Mentor', email: 'susp2@test.com', status: 'suspended' });
    const python = seedSkill('Python Programming');
    const guitar = seedSkill('Guitar');

    seedUserSkill(alice.id, guitar.id, 'offer');
    seedUserSkill(bob.id, python.id, 'offer');
    seedUserSkill(bob.id, guitar.id, 'want');
    seedUserSkill(charlie.id, python.id, 'want'); // no offer skill
    seedUserSkill(suspended.id, python.id, 'offer');

    const agent = await loginAgent(alice.email);
    const res = await agent.get('/requests');

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Swap With');
    expect(res.text).toContain('data-purpose="user-card"');
    expect(res.text).toContain('Bob Mentor');
    expect(res.text).toContain('TEACHES:');
    expect(res.text).toContain('Python Programming');
    expect(res.text).toContain('LEARNS:');
    expect(res.text).toContain('Guitar');
    expect(res.text).toContain('Request Swap');
    expect(res.text).not.toContain('Charlie WantOnly');
    expect(res.text).not.toContain('Susp Mentor');
  });
});
