const request = require('supertest');
const bcrypt = require('bcrypt');

const mockState = {
  users: [],
  messages: [],
  nextIds: { user: 1, message: 1 },
};

function resetMockState() {
  mockState.users.length = 0;
  mockState.messages.length = 0;
  mockState.nextIds = { user: 1, message: 1 };
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
    create: jest.fn(async ({ data }) => {
      const created = {
        id: mockState.nextIds.message++,
        ...data,
        sentAt: data.sentAt || new Date(),
      };
      mockState.messages.push(created);
      return { ...created };
    }),
    findMany: jest.fn(async ({ where, orderBy }) => {
      const list = mockState.messages.filter((m) => {
        if (where?.OR) {
          return where.OR.some((cond) => {
            const matchSender = cond.senderId === undefined || m.senderId === cond.senderId;
            const matchReceiver = cond.receiverId === undefined || m.receiverId === cond.receiverId;
            return matchSender && matchReceiver;
          });
        }
        return true;
      });
      const sorted = [...list].sort((a, b) =>
        orderBy?.sentAt === 'desc' ? b.sentAt - a.sentAt : a.sentAt - b.sentAt
      );
      return sorted.map((m) => ({
        ...m,
        sender: mockState.users.find((u) => u.id === m.senderId) || { id: m.senderId, name: 'User' },
        receiver: mockState.users.find((u) => u.id === m.receiverId) || { id: m.receiverId, name: 'User' },
      }));
    }),
  },
}));

const app = require('../src/app');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"|value="([^"]+)"\s+name="_csrf"/);
  return match ? match[1] || match[2] : null;
}

async function seedUser({ name, email, status = 'active' }) {
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

describe('Phase 6 Messages & Rate Limiting', () => {
  beforeEach(() => {
    resetMockState();
    jest.clearAllMocks();
  });

  test('enforces auth, CSRF, validation, active peer checks, and self-chat rejection', async () => {
    const alice = await seedUser({ name: 'Alice', email: 'alice@test.com' });
    const bob = await seedUser({ name: 'Bob', email: 'bob@test.com' });
    const suspended = await seedUser({ name: 'Suspended', email: 'susp@test.com', status: 'suspended' });

    expect((await request(app).get('/messages')).statusCode).toBe(302);

    const aliceAgent = await loginAgent(alice.email);
    const chatPage = await aliceAgent.get(`/messages/${bob.id}`);
    expect(chatPage.statusCode).toBe(200);
    expect(chatPage.text).toContain('No messages yet');
    const csrf = extractCsrfToken(chatPage.text);

    // Missing CSRF -> 403
    const noCsrf = await aliceAgent.post('/messages').type('form').send({
      receiverId: bob.id,
      content: 'Hello',
    });
    expect(noCsrf.statusCode).toBe(403);

    // Whitespace-only message -> 400 re-render with error message
    const blankRes = await aliceAgent.post('/messages').type('form').send({
      _csrf: csrf,
      receiverId: bob.id,
      content: '    ',
    });
    expect(blankRes.statusCode).toBe(400);
    expect(blankRes.text).toContain('Message cannot be empty.');

    // Self chat & self send -> 400
    expect((await aliceAgent.get(`/messages/${alice.id}`)).statusCode).toBe(400);
    const selfSend = await aliceAgent.post('/messages').type('form').send({
      _csrf: csrf,
      receiverId: alice.id,
      content: 'Talking to myself',
    });
    expect(selfSend.statusCode).toBe(400);

    // Suspended or nonexistent peer -> 404
    expect((await aliceAgent.get(`/messages/${suspended.id}`)).statusCode).toBe(404);
    expect((await aliceAgent.get('/messages/999')).statusCode).toBe(404);
    const sendSusp = await aliceAgent.post('/messages').type('form').send({
      _csrf: csrf,
      receiverId: suspended.id,
      content: 'Hi',
    });
    expect(sendSusp.statusCode).toBe(404);
    expect(mockState.messages).toHaveLength(0);
  });

  test('sending messages updates conversation list (latest per peer) and chat thread for both sides', async () => {
    const alice = await seedUser({ name: 'Alice Chat', email: 'alice@test.com' });
    const bob = await seedUser({ name: 'Bob Chat', email: 'bob@test.com' });
    const carol = await seedUser({ name: 'Carol Chat', email: 'carol@test.com' });

    const aliceAgent = await loginAgent(alice.email);
    const bobAgent = await loginAgent(bob.email);

    // Empty conversations state
    const emptyInbox = await aliceAgent.get('/messages');
    expect(emptyInbox.statusCode).toBe(200);
    expect(emptyInbox.text).toContain('No conversations yet.');

    const aliceCsrf = extractCsrfToken((await aliceAgent.get(`/messages/${bob.id}`)).text);
    const bobCsrf = extractCsrfToken((await bobAgent.get(`/messages/${alice.id}`)).text);

    // Alice sends 2 messages to Bob, Bob replies once, Alice also messages Carol
    const m1 = await aliceAgent.post('/messages').type('form').send({
      _csrf: aliceCsrf,
      receiverId: bob.id,
      content: 'Hi Bob! Ready for Python?',
    });
    expect(m1.statusCode).toBe(302);
    expect(m1.headers.location).toBe(`/messages/${bob.id}`);

    // Make timestamps strictly ordered for deterministic sorting
    mockState.messages[0].sentAt = new Date(Date.now() - 120000);

    await bobAgent.post('/messages').type('form').send({
      _csrf: bobCsrf,
      receiverId: alice.id,
      content: 'Yes! Saturday 10:00 UTC works.',
    });
    mockState.messages[1].sentAt = new Date(Date.now() - 60000);

    await aliceAgent.post('/messages').type('form').send({
      _csrf: aliceCsrf,
      receiverId: carol.id,
      content: 'Hey Carol, let us swap UI/UX!',
    });

    // Conversation list collapses Bob thread to 1 row showing latest message, ordered newest first
    const aliceInbox = await aliceAgent.get('/messages');
    expect(aliceInbox.statusCode).toBe(200);
    expect(aliceInbox.text).toContain('Carol Chat');
    expect(aliceInbox.text).toContain('Hey Carol, let us swap UI/UX!');
    expect(aliceInbox.text).toContain('Bob Chat');
    expect(aliceInbox.text).toContain('Yes! Saturday 10:00 UTC works.');
    expect(aliceInbox.text).not.toContain('Hi Bob! Ready for Python?');
    expect(aliceInbox.text.indexOf('Carol Chat')).toBeLessThan(aliceInbox.text.indexOf('Bob Chat'));

    // Thread shows both messages in chronological order
    const threadRes = await aliceAgent.get(`/messages/${bob.id}`);
    expect(threadRes.statusCode).toBe(200);
    expect(threadRes.text).toContain('Hi Bob! Ready for Python?');
    expect(threadRes.text).toContain('Yes! Saturday 10:00 UTC works.');
    expect(threadRes.text.indexOf('Hi Bob! Ready for Python?')).toBeLessThan(
      threadRes.text.indexOf('Yes! Saturday 10:00 UTC works.')
    );
  });

  test('POST /messages rate limiter returns 429 friendly page after limit exceeded', async () => {
    const alice = await seedUser({ name: 'Spammer Alice', email: 'spam@test.com' });
    const bob = await seedUser({ name: 'Patient Bob', email: 'patient@test.com' });
    const aliceAgent = await loginAgent(alice.email);
    const csrf = extractCsrfToken((await aliceAgent.get(`/messages/${bob.id}`)).text);

    let lastRes;
    for (let i = 0; i < 35; i += 1) {
      lastRes = await aliceAgent.post('/messages').type('form').send({
        _csrf: csrf,
        receiverId: bob.id,
        content: `Msg ${i}`,
      });
      if (lastRes.statusCode === 429) break;
    }

    expect(lastRes.statusCode).toBe(429);
    expect(lastRes.text).toContain('Too Many Requests');
  });
});
