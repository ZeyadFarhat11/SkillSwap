const fs = require('fs/promises');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcrypt');
const sharp = require('sharp');

const mockState = {
  users: [],
  projectLinks: [],
  skills: [],
  userSkills: [],
  availability: [],
  nextIds: { user: 1, link: 1, skill: 1, userSkill: 1, availability: 1 },
  createdUploadFiles: [],
};

function resetMockState() {
  mockState.users.length = 0;
  mockState.projectLinks.length = 0;
  mockState.skills.length = 0;
  mockState.userSkills.length = 0;
  mockState.availability.length = 0;
  mockState.nextIds = { user: 1, link: 1, skill: 1, userSkill: 1, availability: 1 };
}

function mockHydrateUserProfile(user) {
  if (!user) return null;
  const projectLinks = mockState.projectLinks
    .filter((l) => l.userId === user.id)
    .sort((a, b) => a.id - b.id);
  const userSkills = mockState.userSkills
    .filter((us) => us.userId === user.id)
    .map((us) => ({
      ...us,
      skill: mockState.skills.find((s) => s.id === us.skillId),
    }))
    .filter((us) => us.skill && us.skill.status === 'approved')
    .sort((a, b) => a.id - b.id);
  const availability = mockState.availability
    .filter((a) => a.userId === user.id)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.getTime() - b.startTime.getTime());

  return {
    ...user,
    projectLinks,
    userSkills,
    availability,
  };
}

const mockTx = {
  user: {
    update: jest.fn(async ({ where, data }) => {
      const user = mockState.users.find((u) => u.id === where.id);
      if (!user) throw new Error('User not found');
      Object.assign(user, data);
      return { ...user };
    }),
  },
  userProjectLink: {
    deleteMany: jest.fn(async ({ where }) => {
      for (let i = mockState.projectLinks.length - 1; i >= 0; i -= 1) {
        if (mockState.projectLinks[i].userId === where.userId) {
          mockState.projectLinks.splice(i, 1);
        }
      }
      return { count: 0 };
    }),
    createMany: jest.fn(async ({ data }) => {
      for (const item of data) {
        mockState.projectLinks.push({
          id: mockState.nextIds.link++,
          userId: item.userId,
          url: item.url,
          createdAt: new Date(),
        });
      }
      return { count: data.length };
    }),
  },
};

jest.mock('../src/models/prisma', () => ({
  user: {
    findUnique: jest.fn(async ({ where, include }) => {
      const found = mockState.users.find((u) =>
        where.email !== undefined ? u.email === where.email : u.id === where.id
      );
      if (!found) return null;
      return include ? mockHydrateUserProfile(found) : { ...found };
    }),
    update: jest.fn(async ({ where, data }) => {
      const user = mockState.users.find((u) => u.id === where.id);
      if (!user) throw new Error('User not found');
      Object.assign(user, data);
      return { ...user };
    }),
  },
  skill: {
    findMany: jest.fn(async ({ where }) =>
      mockState.skills
        .filter((s) => !where?.status || s.status === where.status)
        .sort((a, b) => a.skillName.localeCompare(b.skillName))
    ),
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.skills.find((s) => s.id === where.id);
      return found ? { ...found } : null;
    }),
  },
  userSkill: {
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
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.userSkills.find((us) => us.id === where.id);
      return found ? { ...found } : null;
    }),
    create: jest.fn(async ({ data }) => {
      const duplicate = mockState.userSkills.find(
        (us) => us.userId === data.userId && us.skillId === data.skillId && us.type === data.type
      );
      if (duplicate) {
        const err = new Error('Unique constraint');
        err.code = 'P2002';
        throw err;
      }
      const created = {
        id: mockState.nextIds.userSkill++,
        userId: data.userId,
        skillId: data.skillId,
        type: data.type,
        level: data.level,
        createdAt: new Date(),
      };
      mockState.userSkills.push(created);
      return {
        ...created,
        skill: mockState.skills.find((s) => s.id === data.skillId),
      };
    }),
    delete: jest.fn(async ({ where }) => {
      const idx = mockState.userSkills.findIndex((us) => us.id === where.id);
      if (idx === -1) throw new Error('Not found');
      const [removed] = mockState.userSkills.splice(idx, 1);
      return removed;
    }),
  },
  availability: {
    findMany: jest.fn(async ({ where }) =>
      mockState.availability
        .filter((a) => {
          if (where.userId !== undefined && a.userId !== where.userId) return false;
          if (where.dayOfWeek !== undefined && a.dayOfWeek !== where.dayOfWeek) return false;
          return true;
        })
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.getTime() - b.startTime.getTime())
    ),
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.availability.find((a) => a.id === where.id);
      return found ? { ...found } : null;
    }),
    create: jest.fn(async ({ data }) => {
      const created = {
        id: mockState.nextIds.availability++,
        userId: data.userId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        createdAt: new Date(),
      };
      mockState.availability.push(created);
      return { ...created };
    }),
    delete: jest.fn(async ({ where }) => {
      const idx = mockState.availability.findIndex((a) => a.id === where.id);
      if (idx === -1) throw new Error('Not found');
      const [removed] = mockState.availability.splice(idx, 1);
      return removed;
    }),
  },
  $transaction: jest.fn(async (cb) => cb(mockTx)),
}));

const app = require('../src/app');
const { formatPrismaTime } = require('../src/utils/time');
const skillService = require('../src/services/skillService');
const availabilityService = require('../src/services/availabilityService');

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

function seedSkills() {
  const entries = [
    { skillName: 'Python Programming', status: 'approved' },
    { skillName: 'Guitar', status: 'approved' },
    { skillName: 'Pending Skill', status: 'pending' },
    { skillName: 'Rejected Skill', status: 'rejected' },
  ];
  return entries.map((e) => {
    const s = { id: mockState.nextIds.skill++, ...e, createdAt: new Date() };
    mockState.skills.push(s);
    return s;
  });
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

describe('Phase 3 Time helper', () => {
  test('formatPrismaTime converts Prisma UTC Date and strings to HH:mm', () => {
    expect(formatPrismaTime(new Date(Date.UTC(1970, 0, 1, 9, 5, 0)))).toBe('09:05');
    expect(formatPrismaTime(new Date('1970-01-01T17:45:00.000Z'))).toBe('17:45');
    expect(formatPrismaTime('08:30:00')).toBe('08:30');
    expect(formatPrismaTime('23:00')).toBe('23:00');
  });
});

describe('Phase 3 Profile, Avatar Upload, Skills, and Availability', () => {
  beforeEach(() => {
    resetMockState();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    for (const filePath of mockState.createdUploadFiles) {
      await fs.unlink(filePath).catch(() => {});
    }
  });

  test('profile routes require authentication and support viewing own and peer profiles', async () => {
    const unauth = await request(app).get('/profile');
    expect(unauth.statusCode).toBe(302);
    expect(unauth.headers.location).toBe('/login');

    const alice = await seedUser({ name: 'Alice Dev', email: 'alice@example.com' });
    const bob = await seedUser({ name: 'Bob Designer', email: 'bob@example.com' });
    const suspended = await seedUser({
      name: 'Suspended User',
      email: 'susp@example.com',
      status: 'suspended',
    });

    const agent = await loginAgent(alice.email);

    const ownRes = await agent.get('/profile');
    expect(ownRes.statusCode).toBe(200);
    expect(ownRes.text).toContain('Alice Dev');
    expect(ownRes.text).toContain('Edit Profile');

    const peerRes = await agent.get(`/users/${bob.id}`);
    expect(peerRes.statusCode).toBe(200);
    expect(peerRes.text).toContain('Bob Designer');
    expect(peerRes.text).not.toContain('Edit Profile');

    const suspendedRes = await agent.get(`/users/${suspended.id}`);
    expect(suspendedRes.statusCode).toBe(404);
  });

  test('POST /profile/edit updates name, bio, and project links in one transaction', async () => {
    const alice = await seedUser({ name: 'Alice Dev', email: 'alice@example.com' });
    const agent = await loginAgent(alice.email);

    const editPage = await agent.get('/profile/edit');
    expect(editPage.statusCode).toBe(200);
    const csrf = extractCsrfToken(editPage.text);

    const badRes = await agent.post('/profile/edit').type('form').send({
      _csrf: csrf,
      name: 'Alice Dev',
      bio: 'CS student',
      projectLinks: ['not-a-valid-url'],
    });
    expect(badRes.statusCode).toBe(400);
    expect(badRes.text).toContain('valid URL');

    const okRes = await agent.post('/profile/edit').type('form').send({
      _csrf: csrf,
      name: 'Alice Updated',
      bio: 'Full-stack builder',
      projectLinks: ['https://github.com/alice/repo1', 'https://alice.dev', ''],
    });
    expect(okRes.statusCode).toBe(302);
    expect(okRes.headers.location).toBe('/profile');

    const profileRes = await agent.get('/profile');
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.text).toContain('Alice Updated');
    expect(profileRes.text).toContain('Full-stack builder');
    expect(profileRes.text).toContain('https://github.com/alice/repo1');
    expect(profileRes.text).toContain('https://alice.dev');
  });

  test('POST /profile/edit saves avatar together with profile changes and discards temp files on validation error', async () => {
    const alice = await seedUser({ name: 'Alice Combo', email: 'combo@example.com' });
    const agent = await loginAgent(alice.email);

    const editPage = await agent.get('/profile/edit');
    expect(editPage.statusCode).toBe(200);
    expect(editPage.text).not.toContain('action="/profile/avatar"');
    expect(editPage.text).toContain('enctype="multipart/form-data"');
    const csrf = extractCsrfToken(editPage.text);

    const validWebp = await sharp({
      create: { width: 500, height: 500, channels: 3, background: { r: 30, g: 120, b: 210 } },
    })
      .webp()
      .toBuffer();

    // Missing CSRF on multipart POST /profile/edit -> 403 and no avatar saved
    const noCsrfRes = await agent
      .post('/profile/edit')
      .field('name', 'Alice Should Fail')
      .attach('avatar', validWebp, { filename: 'combo.webp', contentType: 'image/webp' });
    expect(noCsrfRes.statusCode).toBe(403);
    expect(mockState.users.find((u) => u.id === alice.id).avatarPath).toBeNull();

    // Invalid project link -> 400 and avatar is NOT saved yet
    const invalidFieldRes = await agent
      .post('/profile/edit')
      .field('_csrf', csrf)
      .field('name', 'Alice Combo')
      .field('projectLinks', 'invalid-url')
      .attach('avatar', validWebp, { filename: 'combo.webp', contentType: 'image/webp' });
    expect(invalidFieldRes.statusCode).toBe(400);
    expect(mockState.users.find((u) => u.id === alice.id).avatarPath).toBeNull();

    // Valid multipart submission -> saves profile fields and avatar together
    const okRes = await agent
      .post('/profile/edit')
      .field('_csrf', csrf)
      .field('name', 'Alice Saved Combo')
      .field('bio', 'Saved together on Save Changes')
      .field('projectLinks', 'https://example.com/alice')
      .attach('avatar', validWebp, { filename: 'combo.webp', contentType: 'image/webp' });
    expect(okRes.statusCode).toBe(302);
    expect(okRes.headers.location).toBe('/profile');

    const savedAlice = mockState.users.find((u) => u.id === alice.id);
    expect(savedAlice.name).toBe('Alice Saved Combo');
    expect(savedAlice.bio).toBe('Saved together on Save Changes');
    expect(savedAlice.avatarPath).toMatch(/^uploads\/[0-9a-f-]+\.webp$/);

    const savedDiskPath = path.resolve(process.cwd(), savedAlice.avatarPath);
    mockState.createdUploadFiles.push(savedDiskPath);

    const uploadEntries = await fs.readdir(path.resolve(process.cwd(), 'uploads'));
    expect(uploadEntries.filter((name) => name.startsWith('tmp-'))).toEqual([]);
  });

  test('POST /profile/avatar validates magic bytes with file-type, resizes to 400x400, and enforces CSRF', async () => {
    const alice = await seedUser({ name: 'Alice Avatar', email: 'avatar@example.com' });
    const agent = await loginAgent(alice.email);

    const editPage = await agent.get('/profile/edit');
    const csrf = extractCsrfToken(editPage.text);

    // Reject missing CSRF token
    const validPng = await sharp({
      create: { width: 600, height: 600, channels: 3, background: { r: 10, g: 80, b: 200 } },
    })
      .png()
      .toBuffer();

    const noCsrfRes = await agent.post('/profile/avatar').attach('avatar', validPng, 'avatar.png');
    expect(noCsrfRes.statusCode).toBe(403);

    // Reject fake image disguised as .jpg
    const fakeBuffer = Buffer.from('not-actually-a-jpeg-file');
    const fakeRes = await agent
      .post('/profile/avatar')
      .field('_csrf', csrf)
      .attach('avatar', fakeBuffer, { filename: 'fake.jpg', contentType: 'image/jpeg' });
    expect(fakeRes.statusCode).toBe(400);
    expect(fakeRes.text).toContain('Only JPEG, PNG, and WebP images are allowed.');

    // Upload real 600x600 PNG -> saved as uploads/<uuid>.png and resized to 400x400
    const okRes = await agent
      .post('/profile/avatar')
      .field('_csrf', csrf)
      .attach('avatar', validPng, { filename: 'photo.png', contentType: 'image/png' });
    expect(okRes.statusCode).toBe(302);
    expect(okRes.headers.location).toBe('/profile/edit');

    const updatedAlice = mockState.users.find((u) => u.id === alice.id);
    expect(updatedAlice.avatarPath).toMatch(/^uploads\/[0-9a-f-]+\.png$/);

    const savedDiskPath = path.resolve(process.cwd(), updatedAlice.avatarPath);
    mockState.createdUploadFiles.push(savedDiskPath);

    const meta = await sharp(savedDiskPath).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(400);

    // Verify served via /uploads static mount
    const staticRes = await agent.get(`/${updatedAlice.avatarPath}`);
    expect(staticRes.statusCode).toBe(200);

    // Upload real 500x700 WebP -> saved as uploads/<uuid>.webp, resized to 400x400, deletes old PNG and temp upload
    const validWebp = await sharp({
      create: { width: 500, height: 700, channels: 3, background: { r: 20, g: 160, b: 90 } },
    })
      .webp()
      .toBuffer();

    const webpRes = await agent
      .post('/profile/avatar')
      .field('_csrf', csrf)
      .attach('avatar', validWebp, { filename: 'photo.webp', contentType: 'image/webp' });
    expect(webpRes.statusCode).toBe(302);
    expect(webpRes.headers.location).toBe('/profile/edit');

    const webpAlice = mockState.users.find((u) => u.id === alice.id);
    expect(webpAlice.avatarPath).toMatch(/^uploads\/[0-9a-f-]+\.webp$/);

    const webpDiskPath = path.resolve(process.cwd(), webpAlice.avatarPath);
    mockState.createdUploadFiles.push(webpDiskPath);

    const webpMeta = await sharp(webpDiskPath).metadata();
    expect(webpMeta.width).toBe(400);
    expect(webpMeta.height).toBe(400);
    await expect(fs.stat(savedDiskPath)).rejects.toThrow();

    const webpStaticRes = await agent.get(`/${webpAlice.avatarPath}`);
    expect(webpStaticRes.statusCode).toBe(200);

    // Upload real 800x500 JPEG -> saved as uploads/<uuid>.jpg, resized to 400x400, deletes old WebP
    const validJpeg = await sharp({
      create: { width: 800, height: 500, channels: 3, background: { r: 220, g: 90, b: 40 } },
    })
      .jpeg()
      .toBuffer();

    const jpegRes = await agent
      .post('/profile/avatar')
      .field('_csrf', csrf)
      .attach('avatar', validJpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(jpegRes.statusCode).toBe(302);
    expect(jpegRes.headers.location).toBe('/profile/edit');

    const jpegAlice = mockState.users.find((u) => u.id === alice.id);
    expect(jpegAlice.avatarPath).toMatch(/^uploads\/[0-9a-f-]+\.jpg$/);

    const jpegDiskPath = path.resolve(process.cwd(), jpegAlice.avatarPath);
    mockState.createdUploadFiles.push(jpegDiskPath);

    const jpegMeta = await sharp(jpegDiskPath).metadata();
    expect(jpegMeta.width).toBe(400);
    expect(jpegMeta.height).toBe(400);
    await expect(fs.stat(webpDiskPath)).rejects.toThrow();

    const jpegStaticRes = await agent.get(`/${jpegAlice.avatarPath}`);
    expect(jpegStaticRes.statusCode).toBe(200);

    const uploadEntries = await fs.readdir(path.resolve(process.cwd(), 'uploads'));
    expect(uploadEntries.filter((name) => name.startsWith('tmp-'))).toEqual([]);
  });

  test('skills endpoints and service enforce approved-only, no same skill as both types, and ownership', async () => {
    const alice = await seedUser({ name: 'Alice Skills', email: 'skills@example.com' });
    const bob = await seedUser({ name: 'Bob Skills', email: 'bobskills@example.com' });
    const [python, guitar, pending, rejected] = seedSkills();

    const agent = await loginAgent(alice.email);
    const page = await agent.get('/skills');
    expect(page.statusCode).toBe(200);
    expect(page.text).toContain('Python Programming');
    expect(page.text).not.toContain('Pending Skill');
    expect(page.text).not.toContain('Rejected Skill');

    const csrf = extractCsrfToken(page.text);

    // Reject pending & rejected skills
    const pendingRes = await agent.post('/skills/mine').type('form').send({
      _csrf: csrf,
      skillId: pending.id,
      type: 'offer',
      level: 'intermediate',
    });
    expect(pendingRes.statusCode).toBe(400);
    expect(pendingRes.text).toContain('Only approved skills');

    await expect(
      skillService.addUserSkill(alice.id, {
        skillId: rejected.id,
        type: 'want',
        level: 'beginner',
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    // Add Python as offer
    const addOffer = await agent.post('/skills/mine').type('form').send({
      _csrf: csrf,
      skillId: python.id,
      type: 'offer',
      level: 'advanced',
    });
    expect(addOffer.statusCode).toBe(302);

    // Reject Python as want (same skill cannot be both offer and want)
    const addConflict = await agent.post('/skills/mine').type('form').send({
      _csrf: csrf,
      skillId: python.id,
      type: 'want',
      level: 'beginner',
    });
    expect(addConflict.statusCode).toBe(400);
    expect(addConflict.text).toContain('cannot both offer and want the same skill');

    // Add Guitar as want
    const addWant = await agent.post('/skills/mine').type('form').send({
      _csrf: csrf,
      skillId: guitar.id,
      type: 'want',
      level: 'beginner',
    });
    expect(addWant.statusCode).toBe(302);
    expect(mockState.userSkills).toHaveLength(2);

    // Another user cannot delete Alice's skill
    const aliceEntry = mockState.userSkills[0];
    const bobAgent = await loginAgent(bob.email);
    const bobSkillsPage = await bobAgent.get('/skills');
    const bobCsrf = extractCsrfToken(bobSkillsPage.text);

    const forbiddenDelete = await bobAgent
      .post(`/skills/mine/${aliceEntry.id}/delete`)
      .type('form')
      .send({ _csrf: bobCsrf });
    expect(forbiddenDelete.statusCode).toBe(403);

    // Alice can delete her own skill
    const ownDelete = await agent
      .post(`/skills/mine/${aliceEntry.id}/delete`)
      .type('form')
      .send({ _csrf: csrf });
    expect(ownDelete.statusCode).toBe(302);
    expect(mockState.userSkills).toHaveLength(1);
  });

  test('availability enforces end > start, no overlaps on same day, HH:mm formatting, and ownership', async () => {
    const alice = await seedUser({ name: 'Alice Time', email: 'time@example.com' });
    const bob = await seedUser({ name: 'Bob Time', email: 'bobtime@example.com' });

    const agent = await loginAgent(alice.email);
    const page = await agent.get('/availability');
    expect(page.statusCode).toBe(200);
    const csrf = extractCsrfToken(page.text);

    // Reject end <= start
    const badEnd = await agent.post('/availability').type('form').send({
      _csrf: csrf,
      dayOfWeek: 1,
      startTime: '14:00',
      endTime: '13:00',
    });
    expect(badEnd.statusCode).toBe(400);
    expect(badEnd.text).toContain('End time must be after start time.');

    // Add Monday 09:00 - 11:00
    const addFirst = await agent.post('/availability').type('form').send({
      _csrf: csrf,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '11:00',
    });
    expect(addFirst.statusCode).toBe(302);

    // Reject overlapping slot Monday 10:00 - 12:00
    const overlap = await agent.post('/availability').type('form').send({
      _csrf: csrf,
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '12:00',
    });
    expect(overlap.statusCode).toBe(409);
    expect(overlap.text).toContain('overlaps with an existing availability slot');

    // Adjacent slot Monday 11:00 - 12:30 is allowed
    const adjacent = await agent.post('/availability').type('form').send({
      _csrf: csrf,
      dayOfWeek: 1,
      startTime: '11:00',
      endTime: '12:30',
    });
    expect(adjacent.statusCode).toBe(302);

    const listPage = await agent.get('/availability');
    expect(listPage.text).toContain('Monday');
    expect(listPage.text).toContain('09:00 - 11:00');
    expect(listPage.text).toContain('11:00 - 12:30');

    // Ownership check on delete
    const slotId = mockState.availability[0].id;
    await expect(availabilityService.removeAvailabilitySlot(bob.id, slotId)).rejects.toMatchObject({
      statusCode: 403,
    });

    const delRes = await agent
      .post(`/availability/${slotId}/delete`)
      .type('form')
      .send({ _csrf: csrf });
    expect(delRes.statusCode).toBe(302);
    expect(mockState.availability).toHaveLength(1);
  });
});
