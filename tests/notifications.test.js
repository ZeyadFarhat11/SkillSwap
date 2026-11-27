const request = require('supertest');
const bcrypt = require('bcrypt');

const mockState = {
  users: [],
  skills: [],
  swapRequests: [],
  sessions: [],
  messages: [],
  ratings: [],
  nextIds: { user: 1, skill: 1, req: 1, sess: 1, msg: 1, rating: 1 },
};

function resetMockState() {
  mockState.users.length = 0;
  mockState.skills.length = 0;
  mockState.swapRequests.length = 0;
  mockState.sessions.length = 0;
  mockState.messages.length = 0;
  mockState.ratings.length = 0;
  mockState.nextIds = { user: 1, skill: 1, req: 1, sess: 1, msg: 1, rating: 1 };
}

jest.mock('../src/models/prisma', () => ({
  user: {
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.users.find((u) =>
        where.email !== undefined ? u.email === where.email : u.id === where.id
      );
      return found ? { ...found } : null;
    }),
  },
  message: {
    findFirst: jest.fn(async ({ where }) => {
      const found = mockState.messages.find((m) => {
        if (where?.receiverId !== undefined && m.receiverId !== where.receiverId) return false;
        if (where?.sentAt?.gt && !(m.sentAt > where.sentAt.gt)) return false;
        return true;
      });
      return found ? { id: found.id } : null;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.messages
        .filter((m) => {
          if (where?.receiverId !== undefined && m.receiverId !== where.receiverId) return false;
          if (where?.sentAt?.gt && !(m.sentAt > where.sentAt.gt)) return false;
          return true;
        })
        .sort((a, b) => b.sentAt - a.sentAt)
        .map((m) => ({
          ...m,
          sender: mockState.users.find((u) => u.id === m.senderId) || { id: m.senderId, name: 'User' },
        }))
    ),
  },
  swapRequest: {
    findFirst: jest.fn(async ({ where }) => {
      const found = mockState.swapRequests.find((sr) => {
        if (where?.updatedAt?.gt && !(sr.updatedAt > where.updatedAt.gt)) return false;
        if (where?.OR) {
          return where.OR.some((c) => {
            const matchReceiver =
              c.receiverId === undefined || sr.receiverId === c.receiverId;
            const matchSender = c.senderId === undefined || sr.senderId === c.senderId;
            const matchStatus =
              c.status === undefined
                ? true
                : c.status.in
                  ? c.status.in.includes(sr.status)
                  : sr.status === c.status;
            return matchReceiver && matchSender && matchStatus;
          });
        }
        return true;
      });
      return found ? { id: found.id } : null;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.swapRequests
        .filter((sr) => {
          if (where?.updatedAt?.gt && !(sr.updatedAt > where.updatedAt.gt)) return false;
          if (where?.OR) {
            return where.OR.some(
              (c) =>
                (c.senderId !== undefined && sr.senderId === c.senderId) ||
                (c.receiverId !== undefined && sr.receiverId === c.receiverId)
            );
          }
          return true;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((sr) => ({
          ...sr,
          sender: mockState.users.find((u) => u.id === sr.senderId) || null,
          receiver: mockState.users.find((u) => u.id === sr.receiverId) || null,
          wantedSkill: mockState.skills.find((s) => s.id === sr.wantedSkillId) || null,
        }))
    ),
  },
  session: {
    findFirst: jest.fn(async ({ where }) => {
      const found = mockState.sessions.find((s) => {
        if (where?.updatedAt?.gt && !(s.updatedAt > where.updatedAt.gt)) return false;
        if (where?.OR) {
          return where.OR.some(
            (c) =>
              (c.instructorId !== undefined && s.instructorId === c.instructorId) ||
              (c.learnerId !== undefined && s.learnerId === c.learnerId)
          );
        }
        return true;
      });
      return found ? { id: found.id } : null;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.sessions
        .filter((s) => {
          if (where?.updatedAt?.gt && !(s.updatedAt > where.updatedAt.gt)) return false;
          if (where?.OR) {
            return where.OR.some(
              (c) =>
                (c.instructorId !== undefined && s.instructorId === c.instructorId) ||
                (c.learnerId !== undefined && s.learnerId === c.learnerId)
            );
          }
          return true;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((s) => ({
          ...s,
          instructor: mockState.users.find((u) => u.id === s.instructorId) || null,
          learner: mockState.users.find((u) => u.id === s.learnerId) || null,
          skill: mockState.skills.find((sk) => sk.id === s.skillId) || null,
        }))
    ),
  },
  rating: {
    findFirst: jest.fn(async ({ where }) => {
      const found = mockState.ratings.find((r) => {
        if (where?.revieweeId !== undefined && r.revieweeId !== where.revieweeId) return false;
        if (where?.createdAt?.gt && !(r.createdAt > where.createdAt.gt)) return false;
        return true;
      });
      return found ? { id: found.id } : null;
    }),
    findMany: jest.fn(async ({ where }) =>
      mockState.ratings
        .filter((r) => {
          if (where?.revieweeId !== undefined && r.revieweeId !== where.revieweeId) return false;
          if (where?.createdAt?.gt && !(r.createdAt > where.createdAt.gt)) return false;
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => {
          const sess = mockState.sessions.find((s) => s.id === r.sessionId) || null;
          return {
            ...r,
            reviewer: mockState.users.find((u) => u.id === r.reviewerId) || { id: 0, name: 'User' },
            session: sess
              ? { ...sess, skill: mockState.skills.find((sk) => sk.id === sess.skillId) || null }
              : null,
          };
        })
    ),
  },
}));

const app = require('../src/app');

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

describe('Phase 6.3 Notifications', () => {
  beforeEach(() => {
    resetMockState();
    jest.clearAllMocks();
  });

  test('requires auth, aggregates activity newest-first, and clears via POST /notifications/clear', async () => {
    expect((await request(app).get('/notifications')).statusCode).toBe(302);

    const alice = await seedUser({ name: 'Alice Notify', email: 'alicen@test.com' });
    const bob = await seedUser({ name: 'Bob Sender', email: 'bobn@test.com' });
    const python = { id: mockState.nextIds.skill++, skillName: 'Python Programming' };
    mockState.skills.push(python);

    const now = Date.now();
    // 1. Message received by Alice (oldest)
    mockState.messages.push({
      id: mockState.nextIds.msg++,
      senderId: bob.id,
      receiverId: alice.id,
      content: 'Can we meet on Saturday?',
      sentAt: new Date(now - 3600 * 1000),
    });
    // Outgoing message sent BY Alice (must NOT appear as received message notification)
    mockState.messages.push({
      id: mockState.nextIds.msg++,
      senderId: alice.id,
      receiverId: bob.id,
      content: 'Sent by Alice herself',
      sentAt: new Date(now - 1800 * 1000),
    });

    // 2. Incoming pending swap request
    mockState.swapRequests.push({
      id: mockState.nextIds.req++,
      senderId: bob.id,
      receiverId: alice.id,
      wantedSkillId: python.id,
      offeredSkillId: null,
      status: 'pending',
      createdAt: new Date(now - 2400 * 1000),
      updatedAt: new Date(now - 2400 * 1000),
    });

    // 3. Scheduled session
    const sess = {
      id: mockState.nextIds.sess++,
      instructorId: alice.id,
      learnerId: bob.id,
      skillId: python.id,
      dateTime: new Date(now + 24 * 3600 * 1000),
      status: 'scheduled',
      createdAt: new Date(now - 1200 * 1000),
      updatedAt: new Date(now - 1200 * 1000),
    };
    mockState.sessions.push(sess);

    // 4. Received review (newest)
    mockState.ratings.push({
      id: mockState.nextIds.rating++,
      sessionId: sess.id,
      reviewerId: bob.id,
      revieweeId: alice.id,
      stars: 5,
      comment: 'Helpful session!',
      createdAt: new Date(now - 300 * 1000),
    });

    const agent = await loginAgent(alice.email);
    const res = await agent.get('/notifications');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('href="/notifications"');
    expect(res.text).toContain('Bob Sender left you a 5-star review');
    expect(res.text).toContain('Session scheduled: Python Programming with Bob Sender');
    expect(res.text).toContain('Bob Sender sent you a swap request for Python Programming');
    expect(res.text).toContain('Bob Sender sent you a message');
    expect(res.text).not.toContain('Sent by Alice herself');

    // Newest first order check
    expect(res.text.indexOf('left you a 5-star review')).toBeLessThan(
      res.text.indexOf('sent you a message')
    );

    // Clear All requires CSRF -> 403 without token
    expect((await agent.post('/notifications/clear').type('form').send({})).statusCode).toBe(403);

    // Clear All with CSRF clears existing notifications
    const csrf = extractCsrfToken(res.text);
    const clearRes = await agent
      .post('/notifications/clear')
      .type('form')
      .send({ _csrf: csrf });
    expect(clearRes.statusCode).toBe(302);
    expect(clearRes.headers.location).toBe('/notifications');

    const afterClear = await agent.get('/notifications');
    expect(afterClear.statusCode).toBe(200);
    expect(afterClear.text).toContain('You are all caught up!');
    expect(afterClear.text).not.toContain('Bob Sender sent you a message');

    // A brand-new message arriving AFTER Clear All appears again
    mockState.messages.push({
      id: mockState.nextIds.msg++,
      senderId: bob.id,
      receiverId: alice.id,
      content: 'Brand new follow-up',
      sentAt: new Date(Date.now() + 5000),
    });
    const afterNewEvent = await agent.get('/notifications');
    expect(afterNewEvent.statusCode).toBe(200);
    expect(afterNewEvent.text).toContain('Brand new follow-up');
  });

  test('renders red dot on sidebar icon for unseen notifications and clears it when notifications are viewed', async () => {
    const alice = await seedUser({ name: 'Alice Dot', email: 'alicedot@test.com' });
    const bob = await seedUser({ name: 'Bob Dot', email: 'bobdot@test.com' });

    const agent = await loginAgent(alice.email);

    const extractDotClasses = (html) => {
      const tag = html.match(/<span[^>]*id="notificationDot"[^>]*>/);
      const cls = tag ? tag[0].match(/class="([^"]*)"/) : null;
      return cls ? cls[1] : null;
    };

    // 1. Initially no notifications -> #notificationDot has hidden class
    const dashEmpty = await agent.get('/suggestions');
    expect(dashEmpty.statusCode).toBe(200);
    const dotEmpty = extractDotClasses(dashEmpty.text);
    expect(dotEmpty).toBeTruthy();
    expect(dotEmpty).toContain('hidden');

    // 2. New message arrives -> #notificationDot is visible (not hidden)
    mockState.messages.push({
      id: mockState.nextIds.msg++,
      senderId: bob.id,
      receiverId: alice.id,
      content: 'Unread ping!',
      sentAt: new Date(Date.now() - 5000),
    });

    const dashUnread = await agent.get('/suggestions');
    const dotUnread = extractDotClasses(dashUnread.text);
    expect(dotUnread).toBeTruthy();
    expect(dotUnread).not.toContain('hidden');
    expect(dotUnread).toContain('bg-rose-500');

    // 3. Visiting GET /notifications shows the item and clears the unseen red dot
    const notifPage = await agent.get('/notifications');
    expect(notifPage.statusCode).toBe(200);
    expect(notifPage.text).toContain('Bob Dot sent you a message');

    const dashSeen = await agent.get('/suggestions');
    const dotSeen = extractDotClasses(dashSeen.text);
    expect(dotSeen).toBeTruthy();
    expect(dotSeen).toContain('hidden');

    // 4. Subsequent new notification re-activates the red dot
    mockState.messages.push({
      id: mockState.nextIds.msg++,
      senderId: bob.id,
      receiverId: alice.id,
      content: 'Second unread ping!',
      sentAt: new Date(Date.now() + 5000),
    });

    const dashUnreadAgain = await agent.get('/suggestions');
    const dotUnreadAgain = extractDotClasses(dashUnreadAgain.text);
    expect(dotUnreadAgain).toBeTruthy();
    expect(dotUnreadAgain).not.toContain('hidden');
  });
});
