const mockDb = {
  skills: [],
  users: [],
  userProjectLinks: [],
  userSkills: [],
  availability: [],
  swapRequests: [],
  sessions: [],
  pointsTransactions: [],
  ratings: [],
  messages: [],
  reports: [],
  nextIds: {
    skill: 1,
    user: 1,
    link: 1,
    userSkill: 1,
    availability: 1,
    swapRequest: 1,
    session: 1,
    tx: 1,
    rating: 1,
    message: 1,
    report: 1,
  },
};

function resetMockDb() {
  Object.keys(mockDb).forEach((k) => {
    if (Array.isArray(mockDb[k])) mockDb[k].length = 0;
  });
  Object.keys(mockDb.nextIds).forEach((k) => {
    mockDb.nextIds[k] = 1;
  });
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
}

const mockTx = {
  user: {
    create: jest.fn(async ({ data }) => {
      const created = { id: mockDb.nextIds.user++, ...data, createdAt: new Date() };
      mockDb.users.push(created);
      return { ...created };
    }),
    update: jest.fn(async ({ where, data }) => {
      const user = mockDb.users.find((u) => u.id === where.id);
      if (!user) throw new Error('User not found');
      mockApplyUserUpdate(user, data);
      return { ...user };
    }),
  },
  pointsTransaction: {
    create: jest.fn(async ({ data }) => {
      const created = { id: mockDb.nextIds.tx++, createdAt: new Date(), ...data };
      mockDb.pointsTransactions.push(created);
      return created;
    }),
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockDb.pointsTransactions.push({ id: mockDb.nextIds.tx++, createdAt: new Date(), ...item });
      }
      return { count: data.length };
    }),
  },
  userProjectLink: {
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockDb.userProjectLinks.push({ id: mockDb.nextIds.link++, ...item, createdAt: new Date() });
      }
      return { count: data.length };
    }),
  },
  userSkill: {
    create: jest.fn(async ({ data }) => {
      const created = { id: mockDb.nextIds.userSkill++, ...data, createdAt: new Date() };
      mockDb.userSkills.push(created);
      return created;
    }),
  },
  availability: {
    create: jest.fn(async ({ data }) => {
      const created = { id: mockDb.nextIds.availability++, ...data, createdAt: new Date() };
      mockDb.availability.push(created);
      return created;
    }),
  },
  swapRequest: {
    create: jest.fn(async ({ data }) => {
      const created = { id: mockDb.nextIds.swapRequest++, ...data, createdAt: new Date() };
      mockDb.swapRequests.push(created);
      return created;
    }),
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockDb.swapRequests.push({
          id: mockDb.nextIds.swapRequest++,
          ...item,
          createdAt: new Date(),
        });
      }
      return { count: data.length };
    }),
  },
  session: {
    create: jest.fn(async ({ data }) => {
      const created = { id: mockDb.nextIds.session++, ...data, createdAt: new Date() };
      mockDb.sessions.push(created);
      return created;
    }),
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockDb.sessions.push({ id: mockDb.nextIds.session++, ...item, createdAt: new Date() });
      }
      return { count: data.length };
    }),
  },
  rating: {
    create: jest.fn(async ({ data }) => {
      const created = { id: mockDb.nextIds.rating++, ...data, createdAt: new Date() };
      mockDb.ratings.push(created);
      return created;
    }),
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockDb.ratings.push({ id: mockDb.nextIds.rating++, ...item, createdAt: new Date() });
      }
      return { count: data.length };
    }),
  },
  message: {
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockDb.messages.push({ id: mockDb.nextIds.message++, ...item });
      }
      return { count: data.length };
    }),
  },
  report: {
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockDb.reports.push({ id: mockDb.nextIds.report++, ...item, createdAt: new Date() });
      }
      return { count: data.length };
    }),
  },
};

jest.mock('../src/models/prisma', () => ({
  skill: {
    upsert: jest.fn(async ({ where, create }) => {
      let found = mockDb.skills.find((s) => s.skillName === where.skillName);
      if (!found) {
        found = { id: mockDb.nextIds.skill++, ...create, createdAt: new Date() };
        mockDb.skills.push(found);
      }
      return found;
    }),
    findMany: jest.fn(async () => [...mockDb.skills]),
  },
  user: {
    findUnique: jest.fn(async ({ where }) =>
      mockDb.users.find((u) => u.email === where.email) || null
    ),
  },
  $transaction: jest.fn(async (cb) => cb(mockTx)),
  $disconnect: jest.fn(async () => {}),
}));

const { seedDemoData, DEMO_USERS } = require('../prisma/seedDemo');

describe('Demo Seed Script (prisma/seedDemo.js)', () => {
  beforeEach(() => {
    resetMockDb();
    jest.clearAllMocks();
  });

  test('seeds 5 interacting users idempotently with valid points invariant', async () => {
    const firstRun = await seedDemoData();
    expect(firstRun).toEqual({ skipped: false, userCount: 5 });

    expect(mockDb.skills.length).toBe(20);
    expect(mockDb.users.filter((u) => u.role === 'user')).toHaveLength(5);
    expect(mockDb.userProjectLinks.length).toBeGreaterThanOrEqual(5);
    expect(mockDb.userSkills.length).toBeGreaterThanOrEqual(20);
    expect(mockDb.availability.length).toBe(15);
    expect(mockDb.swapRequests.length).toBe(9);
    expect(mockDb.sessions.length).toBe(6);
    expect(mockDb.ratings.length).toBe(5);
    expect(mockDb.messages.length).toBe(8);
    expect(mockDb.reports.length).toBe(3);

    // Verify points_balance equals sum of points_transactions for every seeded user
    for (const def of DEMO_USERS) {
      const user = mockDb.users.find((u) => u.email === def.email);
      expect(user).toBeTruthy();
      const txSum = mockDb.pointsTransactions
        .filter((pt) => pt.userId === user.id)
        .reduce((sum, pt) => (pt.type === 'spend' ? sum - pt.amount : sum + pt.amount), 0);
      expect(user.pointsBalance).toBe(txSum);
    }

    // Re-running seedDemoData skips cleanly without creating duplicates
    const secondRun = await seedDemoData();
    expect(secondRun).toEqual({ skipped: true });
    expect(mockDb.users.filter((u) => u.role === 'user')).toHaveLength(5);
    expect(mockDb.messages.length).toBe(8);
  });
});
