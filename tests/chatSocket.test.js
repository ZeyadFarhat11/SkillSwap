const http = require('http');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { io: createClient } = require('socket.io-client');

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
const { attachChatSocket } = require('../src/sockets/chatSocket');
const { clearPresence, isUserOnline } = require('../src/sockets/presence');

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

async function getSessionCookie(baseUrl, email) {
  const agent = request.agent(baseUrl);
  const loginPage = await agent.get('/login');
  const csrf = extractCsrfToken(loginPage.text);
  const res = await agent.post('/login').type('form').send({
    _csrf: csrf,
    email,
    password: 'Password123!',
  });
  expect(res.statusCode).toBe(302);
  const cookies = res.headers['set-cookie'] || [];
  const sidCookie = cookies.find((c) => c.startsWith('skillswap.sid='));
  expect(sidCookie).toBeTruthy();
  return sidCookie.split(';')[0];
}

function connectSocket(baseUrl, cookieHeader) {
  return new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: cookieHeader ? { cookie: cookieHeader } : {},
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res) => resolve(res));
  });
}

describe('Phase 6.1 WebSocket Live Chat (Socket.IO)', () => {
  let server;
  let io;
  let baseUrl;
  const openSockets = [];

  beforeEach(async () => {
    resetMockState();
    clearPresence();
    jest.clearAllMocks();

    server = http.createServer(app);
    io = attachChatSocket(server, app.sessionMiddleware, {
      rateLimitWindowMs: 60_000,
      rateLimitMax: 3,
    });
    app.set('io', io);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    while (openSockets.length > 0) {
      const s = openSockets.pop();
      if (s.connected) s.disconnect();
      s.close();
    }
    if (io) {
      await new Promise((resolve) => io.close(resolve));
    }
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('rejects unauthenticated and suspended socket connections', async () => {
    await expect(connectSocket(baseUrl)).rejects.toThrow('Unauthorized');

    const alice = await seedUser({ name: 'Alice', email: 'alice@ws.test' });
    const cookie = await getSessionCookie(baseUrl, alice.email);
    alice.status = 'suspended';

    await expect(connectSocket(baseUrl, cookie)).rejects.toThrow('Unauthorized');
  });

  test('delivers live messages to sender and receiver, tracks presence, and isolates unrelated users', async () => {
    const alice = await seedUser({ name: 'Alice Live', email: 'alice@ws.test' });
    const bob = await seedUser({ name: 'Bob Live', email: 'bob@ws.test' });
    const carol = await seedUser({ name: 'Carol Live', email: 'carol@ws.test' });

    const [aliceCookie, bobCookie, carolCookie] = await Promise.all([
      getSessionCookie(baseUrl, alice.email),
      getSessionCookie(baseUrl, bob.email),
      getSessionCookie(baseUrl, carol.email),
    ]);

    const aliceSocket = await connectSocket(baseUrl, aliceCookie);
    const bobSocket = await connectSocket(baseUrl, bobCookie);
    const carolSocket = await connectSocket(baseUrl, carolCookie);
    openSockets.push(aliceSocket, bobSocket, carolSocket);

    expect(isUserOnline(alice.id)).toBe(true);
    expect(isUserOnline(bob.id)).toBe(true);

    const aliceReceived = [];
    const bobReceived = [];
    const carolReceived = [];
    aliceSocket.on('chat:message', (m) => aliceReceived.push(m));
    bobSocket.on('chat:message', (m) => bobReceived.push(m));
    carolSocket.on('chat:message', (m) => carolReceived.push(m));

    const ack = await emitWithAck(aliceSocket, 'chat:send', {
      receiverId: bob.id,
      content: '  Hey Bob via WebSocket!  ',
    });

    expect(ack.ok).toBe(true);
    expect(ack.message).toMatchObject({
      senderId: alice.id,
      receiverId: bob.id,
      content: 'Hey Bob via WebSocket!',
    });
    expect(mockState.messages).toHaveLength(1);

    await new Promise((r) => setTimeout(r, 40));

    expect(aliceReceived).toHaveLength(1);
    expect(bobReceived).toHaveLength(1);
    expect(bobReceived[0].content).toBe('Hey Bob via WebSocket!');
    expect(carolReceived).toHaveLength(0);

    // Presence transitions offline when Bob disconnects
    const offlineEvent = new Promise((resolve) => {
      aliceSocket.once('presence:update', (evt) => {
        if (evt.userId === bob.id && evt.online === false) resolve(evt);
      });
    });
    bobSocket.disconnect();
    await offlineEvent;
    expect(isUserOnline(bob.id)).toBe(false);
  });

  test('enforces validation and active receiver checks on chat:send', async () => {
    const alice = await seedUser({ name: 'Alice', email: 'alice2@ws.test' });
    const bob = await seedUser({ name: 'Bob', email: 'bob2@ws.test' });
    const susp = await seedUser({ name: 'Suspended', email: 'susp@ws.test', status: 'suspended' });

    const aliceCookie = await getSessionCookie(baseUrl, alice.email);
    const socket = await connectSocket(baseUrl, aliceCookie);
    openSockets.push(socket);

    const emptyAck = await emitWithAck(socket, 'chat:send', {
      receiverId: bob.id,
      content: '   ',
    });
    expect(emptyAck).toMatchObject({ ok: false, statusCode: 400 });

    const selfAck = await emitWithAck(socket, 'chat:send', {
      receiverId: alice.id,
      content: 'Self msg',
    });
    expect(selfAck).toMatchObject({ ok: false, statusCode: 400 });

    const suspAck = await emitWithAck(socket, 'chat:send', {
      receiverId: susp.id,
      content: 'Hi suspended',
    });
    expect(suspAck).toMatchObject({ ok: false, statusCode: 404 });
    expect(mockState.messages).toHaveLength(0);
  });

  test('enforces per-user WebSocket rate limit on chat:send', async () => {
    const alice = await seedUser({ name: 'Alice Limit', email: 'alicelim@ws.test' });
    const bob = await seedUser({ name: 'Bob Limit', email: 'boblim@ws.test' });

    const aliceCookie = await getSessionCookie(baseUrl, alice.email);
    const socket = await connectSocket(baseUrl, aliceCookie);
    openSockets.push(socket);

    // 3 allowed messages succeed; 4th triggers 429 rate limit
    for (let i = 1; i <= 3; i += 1) {
      const okAck = await emitWithAck(socket, 'chat:send', {
        receiverId: bob.id,
        content: `Message ${i}`,
      });
      expect(okAck.ok).toBe(true);
    }

    const limitedAck = await emitWithAck(socket, 'chat:send', {
      receiverId: bob.id,
      content: 'Message 4',
    });
    expect(limitedAck).toMatchObject({ ok: false, statusCode: 429 });
    expect(limitedAck.error).toContain('Too many messages');
    expect(mockState.messages).toHaveLength(3);
  });
});
