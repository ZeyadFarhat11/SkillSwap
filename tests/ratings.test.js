const request = require('supertest');
const bcrypt = require('bcrypt');

const mockState = {
  users: [],
  skills: [],
  sessions: [],
  ratings: [],
  nextIds: { user: 1, skill: 1, session: 1, rating: 1 },
};

function resetMockState() {
  mockState.users.length = 0;
  mockState.skills.length = 0;
  mockState.sessions.length = 0;
  mockState.ratings.length = 0;
  mockState.nextIds = { user: 1, skill: 1, session: 1, rating: 1 };
}

function mockHydrateSession(sess) {
  if (!sess) return null;
  return {
    ...sess,
    swapRequest: null,
    instructor: mockState.users.find((u) => u.id === sess.instructorId) || null,
    learner: mockState.users.find((u) => u.id === sess.learnerId) || null,
    skill: mockState.skills.find((s) => s.id === sess.skillId) || null,
    ratings: mockState.ratings.filter((r) => r.sessionId === sess.id),
  };
}

jest.mock('../src/models/prisma', () => ({
  user: {
    findUnique: jest.fn(async ({ where, include }) => {
      const found = mockState.users.find((u) =>
        where.email !== undefined ? u.email === where.email : u.id === where.id
      );
      if (!found) return null;
      return include
        ? { ...found, projectLinks: [], userSkills: [], availability: [] }
        : { ...found };
    }),
  },
  session: {
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.sessions.find((s) => s.id === where.id);
      return mockHydrateSession(found);
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.sessions
        .filter((s) => {
          if (where?.OR) {
            return where.OR.some(
              (c) =>
                (c.instructorId !== undefined && s.instructorId === c.instructorId) ||
                (c.learnerId !== undefined && s.learnerId === c.learnerId)
            );
          }
          return true;
        })
        .map(mockHydrateSession)
    ),
  },
  swapRequest: {
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  },
  rating: {
    create: jest.fn(async ({ data }) => {
      const duplicate = mockState.ratings.find(
        (r) => r.sessionId === data.sessionId && r.reviewerId === data.reviewerId
      );
      if (duplicate) {
        const err = new Error('Unique constraint');
        err.code = 'P2002';
        throw err;
      }
      const created = {
        id: mockState.nextIds.rating++,
        ...data,
        createdAt: new Date(),
      };
      mockState.ratings.push(created);
      return { ...created };
    }),
    findFirst: jest.fn(async ({ where }) => {
      const found = mockState.ratings.find(
        (r) => r.sessionId === where.sessionId && r.reviewerId === where.reviewerId
      );
      return found ? { ...found } : null;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.ratings
        .filter((r) => (where?.revieweeId !== undefined ? r.revieweeId === where.revieweeId : true))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({
          ...r,
          reviewer: mockState.users.find((u) => u.id === r.reviewerId) || { id: 0, name: 'User' },
        }))
    ),
  },
}));

const app = require('../src/app');
const ratingService = require('../src/services/ratingService');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"|value="([^"]+)"\s+name="_csrf"/);
  return match ? match[1] || match[2] : null;
}

async function seedUser({ name, email }) {
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
    pointsBalance: 20,
    createdAt: new Date(),
  };
  mockState.users.push(user);
  return user;
}

function seedSkill(skillName) {
  const skill = {
    id: mockState.nextIds.skill++,
    skillName,
    status: 'approved',
    createdAt: new Date(),
  };
  mockState.skills.push(skill);
  return skill;
}

function seedSession({ instructorId, learnerId, skillId, status = 'completed' }) {
  const sess = {
    id: mockState.nextIds.session++,
    swapRequestId: 1,
    instructorId,
    learnerId,
    skillId,
    dateTime: new Date('2026-11-20T10:00:00.000Z'),
    status,
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockState.sessions.push(sess);
  return sess;
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

describe('Phase 6 Ratings & Reviews', () => {
  beforeEach(() => {
    resetMockState();
    jest.clearAllMocks();
  });

  test('enforces authentication, CSRF, completed status, participant auth, and star bounds', async () => {
    const alice = await seedUser({ name: 'Alice Learner', email: 'alice@test.com' });
    const bob = await seedUser({ name: 'Bob Teacher', email: 'bob@test.com' });
    const charlie = await seedUser({ name: 'Charlie Outsider', email: 'charlie@test.com' });
    const python = seedSkill('Python');

    const scheduledSess = seedSession({
      instructorId: bob.id,
      learnerId: alice.id,
      skillId: python.id,
      status: 'scheduled',
    });
    const completedSess = seedSession({
      instructorId: bob.id,
      learnerId: alice.id,
      skillId: python.id,
      status: 'completed',
    });

    // Unauthenticated GET -> 302 login; POST without CSRF -> 403; POST with guest CSRF -> 302 login
    const unauthGet = await request(app).get(`/sessions/${completedSess.id}/review`);
    expect(unauthGet.statusCode).toBe(302);
    expect(unauthGet.headers.location).toBe('/login');

    const unauthPostNoCsrf = await request(app)
      .post(`/sessions/${completedSess.id}/rating`)
      .type('form')
      .send({ stars: 5 });
    expect(unauthPostNoCsrf.statusCode).toBe(403);

    const guestAgent = request.agent(app);
    const guestCsrf = extractCsrfToken((await guestAgent.get('/login')).text);
    const unauthPost = await guestAgent
      .post(`/sessions/${completedSess.id}/rating`)
      .type('form')
      .send({ _csrf: guestCsrf, stars: 5 });
    expect(unauthPost.statusCode).toBe(302);
    expect(unauthPost.headers.location).toBe('/login');

    const aliceAgent = await loginAgent(alice.email);
    const charlieAgent = await loginAgent(charlie.email);
    const reviewPage = await aliceAgent.get(`/sessions/${completedSess.id}/review`);
    expect(reviewPage.statusCode).toBe(200);
    const aliceCsrf = extractCsrfToken(reviewPage.text);

    const charliePage = await charlieAgent.get('/sessions');
    const charlieCsrf = extractCsrfToken(charliePage.text);

    // Missing CSRF -> 403
    const noCsrf = await aliceAgent.post(`/sessions/${completedSess.id}/rating`).type('form').send({
      stars: 5,
    });
    expect(noCsrf.statusCode).toBe(403);

    // Scheduled session cannot be reviewed or rated -> 400
    const reviewScheduled = await aliceAgent.get(`/sessions/${scheduledSess.id}/review`);
    expect(reviewScheduled.statusCode).toBe(400);

    const rateScheduled = await aliceAgent
      .post(`/sessions/${scheduledSess.id}/rating`)
      .type('form')
      .send({ _csrf: aliceCsrf, stars: 5 });
    expect(rateScheduled.statusCode).toBe(400);
    expect(rateScheduled.text).toContain('completed session');

    // Non-participant cannot rate -> 403
    const outsiderRes = await charlieAgent
      .post(`/sessions/${completedSess.id}/rating`)
      .type('form')
      .send({ _csrf: charlieCsrf, stars: 5 });
    expect(outsiderRes.statusCode).toBe(403);

    // Invalid stars (0 or 6) -> 400
    const lowStars = await aliceAgent
      .post(`/sessions/${completedSess.id}/rating`)
      .type('form')
      .send({ _csrf: aliceCsrf, stars: 0 });
    expect(lowStars.statusCode).toBe(400);

    const highStars = await aliceAgent
      .post(`/sessions/${completedSess.id}/rating`)
      .type('form')
      .send({ _csrf: aliceCsrf, stars: 6 });
    expect(highStars.statusCode).toBe(400);
    expect(mockState.ratings).toHaveLength(0);
  });

  test('both participants can rate once each, blocks duplicates with 409, and updates profile average rating', async () => {
    const alice = await seedUser({ name: 'Alice Learner', email: 'alice@test.com' });
    const bob = await seedUser({ name: 'Bob Teacher', email: 'bob@test.com' });
    const carol = await seedUser({ name: 'Carol Reviewer', email: 'carol@test.com' });
    const python = seedSkill('Python');
    const sql = seedSkill('SQL');

    const sess1 = seedSession({
      instructorId: bob.id,
      learnerId: alice.id,
      skillId: python.id,
      status: 'completed',
    });
    const sess2 = seedSession({
      instructorId: bob.id,
      learnerId: carol.id,
      skillId: sql.id,
      status: 'completed',
    });

    const aliceAgent = await loginAgent(alice.email);
    const bobAgent = await loginAgent(bob.email);
    const carolAgent = await loginAgent(carol.email);

    const aliceCsrf = extractCsrfToken((await aliceAgent.get(`/sessions/${sess1.id}/review`)).text);
    const bobCsrf = extractCsrfToken((await bobAgent.get(`/sessions/${sess1.id}/review`)).text);
    const carolCsrf = extractCsrfToken((await carolAgent.get(`/sessions/${sess2.id}/review`)).text);

    // Alice rates Bob (5 stars) -> revieweeId must be Bob
    const res1 = await aliceAgent.post(`/sessions/${sess1.id}/rating`).type('form').send({
      _csrf: aliceCsrf,
      stars: 5,
      comment: '   Great explanation of generators!   ',
    });
    expect(res1.statusCode).toBe(302);
    expect(res1.headers.location).toBe('/sessions');
    expect(mockState.ratings[0]).toMatchObject({
      sessionId: sess1.id,
      reviewerId: alice.id,
      revieweeId: bob.id,
      stars: 5,
      comment: 'Great explanation of generators!',
    });

    // Alice cannot rate sess1 a second time -> 409, and /sessions shows Reviewed instead of Leave Review
    const dupRes = await aliceAgent.post(`/sessions/${sess1.id}/rating`).type('form').send({
      _csrf: aliceCsrf,
      stars: 4,
    });
    expect(dupRes.statusCode).toBe(409);

    const aliceSessionsPage = await aliceAgent.get('/sessions');
    expect(aliceSessionsPage.statusCode).toBe(200);
    expect(aliceSessionsPage.text).toContain('Reviewed');
    expect(aliceSessionsPage.text).not.toContain(`/sessions/${sess1.id}/review`);

    // Bob (other participant) can still rate Alice for the same session -> revieweeId must be Alice
    const res2 = await bobAgent.post(`/sessions/${sess1.id}/rating`).type('form').send({
      _csrf: bobCsrf,
      stars: 4,
      comment: 'Prepared good questions.',
    });
    expect(res2.statusCode).toBe(302);
    expect(mockState.ratings[1]).toMatchObject({
      sessionId: sess1.id,
      reviewerId: bob.id,
      revieweeId: alice.id,
      stars: 4,
    });

    // Carol also rates Bob (4 stars) -> Bob average = (5 + 4) / 2 = 4.5
    await carolAgent.post(`/sessions/${sess2.id}/rating`).type('form').send({
      _csrf: carolCsrf,
      stars: 4,
      comment: '',
    });

    const summary = await ratingService.getReceivedReviews(bob.id);
    expect(summary.averageRating).toBe('4.5');
    expect(summary.reviews).toHaveLength(2);

    // Bob's profile (/profile) and public view (/users/:id) both show received reviews & average
    const bobOwnProfile = await bobAgent.get('/profile');
    expect(bobOwnProfile.statusCode).toBe(200);
    expect(bobOwnProfile.text).toContain('4.5');
    expect(bobOwnProfile.text).toContain('Great explanation of generators!');

    const peerViewBob = await aliceAgent.get(`/users/${bob.id}`);
    expect(peerViewBob.statusCode).toBe(200);
    expect(peerViewBob.text).toContain('4.5');
    expect(peerViewBob.text).toContain('Great explanation of generators!');
    expect(peerViewBob.text).toContain(`/messages/${bob.id}`);
  });
});
