require('dotenv').config();
const bcrypt = require('bcrypt');
const prisma = require('../src/models/prisma');
const { seedSkills, seedAdminUser } = require('./seed');
const { timeStringToPrismaDate } = require('../src/utils/time');
const {
  BCRYPT_ROUNDS,
  POINTS_PER_SESSION,
  POINTS_TYPES,
  REPORT_STATUSES,
  REPORT_TYPES,
  SESSION_STATUSES,
  SKILL_LEVELS,
  SKILL_TYPES,
  STARTER_POINTS,
  SWAP_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} = require('../src/config/constants');

const DEMO_USERS = [
  {
    key: 'salma',
    name: 'Salma Mohammed',
    email: 'salma@skillswap.local',
    bio: 'CS senior and Python mentor. Happy to help with algorithms, backend APIs, and clean code.',
    projectLinks: [
      'https://github.com/salma-dev/python-roadmap',
      'https://salma.dev/portfolio',
    ],
    skills: [
      { skillName: 'Python Programming', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'Data Structures', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'Web Development', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.INTERMEDIATE },
      { skillName: 'UI/UX Design', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.BEGINNER },
      { skillName: 'Guitar', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.BEGINNER },
    ],
    availability: [
      { dayOfWeek: 1, start: '18:00', end: '21:00' },
      { dayOfWeek: 3, start: '10:00', end: '15:00' },
      { dayOfWeek: 6, start: '09:00', end: '14:00' },
    ],
  },
  {
    key: 'omar',
    name: 'Omar Hassan',
    email: 'omar@skillswap.local',
    bio: 'Product & UI/UX designer focused on Figma design systems and accessible web interfaces.',
    projectLinks: [
      'https://github.com/omar-ux/design-system',
      'https://dribbble.com/omar-hassan',
    ],
    skills: [
      { skillName: 'UI/UX Design', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'Figma Design', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'Python Programming', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.BEGINNER },
      { skillName: 'React', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.INTERMEDIATE },
    ],
    availability: [
      { dayOfWeek: 3, start: '11:00', end: '16:00' },
      { dayOfWeek: 5, start: '14:00', end: '18:00' },
      { dayOfWeek: 6, start: '10:00', end: '15:00' },
    ],
  },
  {
    key: 'nour',
    name: 'Nour Ali',
    email: 'nour@skillswap.local',
    bio: 'Frontend engineer building interactive apps with React, TypeScript, and modern CSS.',
    projectLinks: ['https://github.com/nour-fe/react-starter'],
    skills: [
      { skillName: 'React', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'TypeScript', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.INTERMEDIATE },
      { skillName: 'JavaScript', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'SQL & Databases', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.BEGINNER },
      { skillName: 'Machine Learning', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.BEGINNER },
    ],
    availability: [
      { dayOfWeek: 2, start: '17:00', end: '20:00' },
      { dayOfWeek: 3, start: '12:00', end: '17:00' },
      { dayOfWeek: 6, start: '11:00', end: '16:00' },
    ],
  },
  {
    key: 'karim',
    name: 'Karim Adel',
    email: 'karim@skillswap.local',
    bio: 'Database architect and security enthusiast exploring ML pipelines and technical speaking.',
    projectLinks: ['https://github.com/karim-sec/sql-audit-kit'],
    skills: [
      { skillName: 'SQL & Databases', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'Cybersecurity', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.INTERMEDIATE },
      { skillName: 'Machine Learning', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.INTERMEDIATE },
      { skillName: 'Public Speaking', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.BEGINNER },
      { skillName: 'React', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.INTERMEDIATE },
    ],
    availability: [
      { dayOfWeek: 3, start: '10:00', end: '14:00' },
      { dayOfWeek: 4, start: '16:00', end: '20:00' },
      { dayOfWeek: 6, start: '10:00', end: '14:00' },
    ],
  },
  {
    key: 'maya',
    name: 'Maya Tarek',
    email: 'maya@skillswap.local',
    bio: 'Acoustic guitarist, presentation coach, and video creator learning web development.',
    projectLinks: ['https://github.com/maya-creative/stage-notes'],
    skills: [
      { skillName: 'Guitar', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'Public Speaking', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.ADVANCED },
      { skillName: 'Video Editing', type: SKILL_TYPES.OFFER, level: SKILL_LEVELS.INTERMEDIATE },
      { skillName: 'Web Development', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.BEGINNER },
      { skillName: 'Figma Design', type: SKILL_TYPES.WANT, level: SKILL_LEVELS.BEGINNER },
    ],
    availability: [
      { dayOfWeek: 1, start: '18:00', end: '20:00' },
      { dayOfWeek: 3, start: '11:00', end: '15:00' },
      { dayOfWeek: 6, start: '11:00', end: '15:00' },
    ],
  },
];

/**
 * Compute next occurrence (future) or previous occurrence (past) of a UTC weekday + hour.
 */
function pickDateOnWeekday(dayOfWeek, hour, { future = true, daysOffset = 0 } = {}) {
  const now = new Date();
  const base = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0)
  );
  const currentDay = base.getUTCDay();
  let diff = (dayOfWeek - currentDay + 7) % 7;
  if (future) {
    if (diff === 0) diff = 7;
    diff += daysOffset;
  } else {
    diff = diff === 0 ? -7 : diff - 7;
    diff -= daysOffset;
  }
  base.setUTCDate(base.getUTCDate() + diff);
  return base;
}

/**
 * Populate 5 realistic users and full cross-feature interactions idempotently.
 */
async function seedDemoData() {
  await seedSkills();
  if (process.env.SEED_ADMIN_PASSWORD) {
    await seedAdminUser();
  }

  const existingSalma = await prisma.user.findUnique({
    where: { email: DEMO_USERS[0].email },
  });
  if (existingSalma) {
    console.log('Demo dataset already present (salma@skillswap.local exists). Skipping.');
    return { skipped: true };
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'Password123!';
  const rounds = process.env.NODE_ENV === 'test' ? 4 : BCRYPT_ROUNDS;
  const passwordHash = await bcrypt.hash(demoPassword, rounds);

  const allSkills = await prisma.skill.findMany();
  const skillByName = new Map(allSkills.map((s) => [s.skillName, s]));

  const pastWed12 = pickDateOnWeekday(3, 12, { future: false, daysOffset: 14 });
  const pastSat11 = pickDateOnWeekday(6, 11, { future: false, daysOffset: 7 });
  const pastSat13 = pickDateOnWeekday(6, 13, { future: false, daysOffset: 3 });
  const futureWed13 = pickDateOnWeekday(3, 13, { future: true });

  const result = await prisma.$transaction(async (tx) => {
    const users = {};

    // 1. Create the 5 demo users with starter bonus points, project links, skills, and availability
    for (const def of DEMO_USERS) {
      const user = await tx.user.create({
        data: {
          name: def.name,
          email: def.email,
          passwordHash,
          role: USER_ROLES.USER,
          status: USER_STATUSES.ACTIVE,
          bio: def.bio,
          pointsBalance: STARTER_POINTS,
        },
      });
      users[def.key] = user;

      if (STARTER_POINTS > 0) {
        await tx.pointsTransaction.create({
          data: {
            userId: user.id,
            type: POINTS_TYPES.BONUS,
            amount: STARTER_POINTS,
            createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          },
        });
      }

      if (def.projectLinks.length > 0) {
        await tx.userProjectLink.createMany({
          data: def.projectLinks.map((url) => ({ userId: user.id, url })),
        });
      }

      for (const sk of def.skills) {
        const skillRow = skillByName.get(sk.skillName);
        if (skillRow) {
          await tx.userSkill.create({
            data: {
              userId: user.id,
              skillId: skillRow.id,
              type: sk.type,
              level: sk.level,
            },
          });
        }
      }

      for (const slot of def.availability) {
        await tx.availability.create({
          data: {
            userId: user.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: timeStringToPrismaDate(slot.start),
            endTime: timeStringToPrismaDate(slot.end),
          },
        });
      }
    }

    const sid = (name) => skillByName.get(name).id;

    // 2. Completed one-way swap: Omar learns Python from Salma (+10 Salma, -10 Omar)
    const req1 = await tx.swapRequest.create({
      data: {
        senderId: users.omar.id,
        receiverId: users.salma.id,
        wantedSkillId: sid('Python Programming'),
        offeredSkillId: null,
        status: SWAP_STATUSES.COMPLETED,
      },
    });
    const sess1 = await tx.session.create({
      data: {
        swapRequestId: req1.id,
        instructorId: users.salma.id,
        learnerId: users.omar.id,
        skillId: sid('Python Programming'),
        dateTime: pastWed12,
        status: SESSION_STATUSES.COMPLETED,
        summary: 'Covered Python functions, list comprehensions, and dictionary patterns.',
      },
    });
    await tx.user.update({
      where: { id: users.omar.id },
      data: { pointsBalance: { decrement: POINTS_PER_SESSION } },
    });
    await tx.user.update({
      where: { id: users.salma.id },
      data: { pointsBalance: { increment: POINTS_PER_SESSION } },
    });
    await tx.pointsTransaction.createMany({
      data: [
        {
          userId: users.omar.id,
          sessionId: sess1.id,
          type: POINTS_TYPES.SPEND,
          amount: POINTS_PER_SESSION,
          createdAt: pastWed12,
        },
        {
          userId: users.salma.id,
          sessionId: sess1.id,
          type: POINTS_TYPES.EARN,
          amount: POINTS_PER_SESSION,
          createdAt: pastWed12,
        },
      ],
    });
    await tx.rating.createMany({
      data: [
        {
          sessionId: sess1.id,
          reviewerId: users.omar.id,
          revieweeId: users.salma.id,
          stars: 5,
          comment: 'Salma broke down Python concepts clearly with practical examples!',
        },
        {
          sessionId: sess1.id,
          reviewerId: users.salma.id,
          revieweeId: users.omar.id,
          stars: 5,
          comment: 'Omar was punctual, engaged, and came prepared with great questions.',
        },
      ],
    });

    // 3. Completed mutual swap: Nour learns SQL & Databases <-> Karim learns React (0 points)
    const req2 = await tx.swapRequest.create({
      data: {
        senderId: users.nour.id,
        receiverId: users.karim.id,
        wantedSkillId: sid('SQL & Databases'),
        offeredSkillId: sid('React'),
        status: SWAP_STATUSES.COMPLETED,
      },
    });
    const sess2a = await tx.session.create({
      data: {
        swapRequestId: req2.id,
        instructorId: users.karim.id,
        learnerId: users.nour.id,
        skillId: sid('SQL & Databases'),
        dateTime: pastSat11,
        status: SESSION_STATUSES.COMPLETED,
        summary: 'Walked through relational joins, composite indexes, and query plans.',
      },
    });
    const sess2b = await tx.session.create({
      data: {
        swapRequestId: req2.id,
        instructorId: users.nour.id,
        learnerId: users.karim.id,
        skillId: sid('React'),
        dateTime: pastSat11,
        status: SESSION_STATUSES.COMPLETED,
        summary: 'Built a reusable hook and component state pattern.',
      },
    });
    await tx.rating.createMany({
      data: [
        {
          sessionId: sess2a.id,
          reviewerId: users.nour.id,
          revieweeId: users.karim.id,
          stars: 5,
          comment: 'Crystal-clear walkthrough of indexing and normalization.',
        },
        {
          sessionId: sess2b.id,
          reviewerId: users.karim.id,
          revieweeId: users.nour.id,
          stars: 4,
          comment: 'Really practical React tips and clean component examples.',
        },
      ],
    });

    // 4. Completed one-way swap: Maya learns Figma Design from Omar (only Maya reviewed so Omar can still test Leave Review)
    const req3 = await tx.swapRequest.create({
      data: {
        senderId: users.maya.id,
        receiverId: users.omar.id,
        wantedSkillId: sid('Figma Design'),
        offeredSkillId: null,
        status: SWAP_STATUSES.COMPLETED,
      },
    });
    const sess3 = await tx.session.create({
      data: {
        swapRequestId: req3.id,
        instructorId: users.omar.id,
        learnerId: users.maya.id,
        skillId: sid('Figma Design'),
        dateTime: pastSat13,
        status: SESSION_STATUSES.COMPLETED,
        summary: 'Auto-layout, variants, and component libraries in Figma.',
      },
    });
    await tx.user.update({
      where: { id: users.maya.id },
      data: { pointsBalance: { decrement: POINTS_PER_SESSION } },
    });
    await tx.user.update({
      where: { id: users.omar.id },
      data: { pointsBalance: { increment: POINTS_PER_SESSION } },
    });
    await tx.pointsTransaction.createMany({
      data: [
        {
          userId: users.maya.id,
          sessionId: sess3.id,
          type: POINTS_TYPES.SPEND,
          amount: POINTS_PER_SESSION,
          createdAt: pastSat13,
        },
        {
          userId: users.omar.id,
          sessionId: sess3.id,
          type: POINTS_TYPES.EARN,
          amount: POINTS_PER_SESSION,
          createdAt: pastSat13,
        },
      ],
    });
    await tx.rating.create({
      data: {
        sessionId: sess3.id,
        reviewerId: users.maya.id,
        revieweeId: users.omar.id,
        stars: 5,
        comment: 'Omar showed great Figma shortcuts for prototyping.',
      },
    });

    // 5. Accepted mutual swap with upcoming scheduled sessions: Salma <-> Maya
    const req4 = await tx.swapRequest.create({
      data: {
        senderId: users.salma.id,
        receiverId: users.maya.id,
        wantedSkillId: sid('Guitar'),
        offeredSkillId: sid('Web Development'),
        status: SWAP_STATUSES.ACCEPTED,
      },
    });
    await tx.session.createMany({
      data: [
        {
          swapRequestId: req4.id,
          instructorId: users.maya.id,
          learnerId: users.salma.id,
          skillId: sid('Guitar'),
          dateTime: futureWed13,
          status: SESSION_STATUSES.SCHEDULED,
        },
        {
          swapRequestId: req4.id,
          instructorId: users.salma.id,
          learnerId: users.maya.id,
          skillId: sid('Web Development'),
          dateTime: futureWed13,
          status: SESSION_STATUSES.SCHEDULED,
        },
      ],
    });

    // 6. Accepted one-way swap waiting to be scheduled in /sessions UI: Karim -> Maya
    await tx.swapRequest.create({
      data: {
        senderId: users.karim.id,
        receiverId: users.maya.id,
        wantedSkillId: sid('Public Speaking'),
        offeredSkillId: null,
        status: SWAP_STATUSES.ACCEPTED,
      },
    });

    // 7. Pending, declined, and cancelled swap requests
    await tx.swapRequest.createMany({
      data: [
        {
          senderId: users.maya.id,
          receiverId: users.salma.id,
          wantedSkillId: sid('Python Programming'),
          offeredSkillId: sid('Guitar'),
          status: SWAP_STATUSES.PENDING,
        },
        {
          senderId: users.nour.id,
          receiverId: users.omar.id,
          wantedSkillId: sid('UI/UX Design'),
          offeredSkillId: null,
          status: SWAP_STATUSES.PENDING,
        },
        {
          senderId: users.karim.id,
          receiverId: users.nour.id,
          wantedSkillId: sid('TypeScript'),
          offeredSkillId: null,
          status: SWAP_STATUSES.DECLINED,
        },
        {
          senderId: users.omar.id,
          receiverId: users.karim.id,
          wantedSkillId: sid('Cybersecurity'),
          offeredSkillId: null,
          status: SWAP_STATUSES.CANCELLED,
        },
      ],
    });

    // 8. Messages across multiple threads
    const now = Date.now();
    await tx.message.createMany({
      data: [
        {
          senderId: users.omar.id,
          receiverId: users.salma.id,
          content: 'Hi Salma! Could we review Python list comprehensions this week?',
          sentAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        },
        {
          senderId: users.salma.id,
          receiverId: users.omar.id,
          content: 'Sure Omar! Wednesday at 12:00 UTC works great for me.',
          sentAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        },
        {
          senderId: users.omar.id,
          receiverId: users.salma.id,
          content: 'Thanks for the awesome session, left you a 5-star review!',
          sentAt: new Date(now - 2 * 60 * 60 * 1000),
        },
        {
          senderId: users.nour.id,
          receiverId: users.karim.id,
          content: 'Hey Karim, ready to swap SQL indexing for React hooks?',
          sentAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
        {
          senderId: users.karim.id,
          receiverId: users.nour.id,
          content: 'Yes! Both sessions on Saturday were super helpful.',
          sentAt: new Date(now - 26 * 60 * 60 * 1000),
        },
        {
          senderId: users.salma.id,
          receiverId: users.maya.id,
          content: 'Looking forward to our Guitar & Web Dev sessions on Wednesday!',
          sentAt: new Date(now - 45 * 60 * 1000),
        },
        {
          senderId: users.maya.id,
          receiverId: users.salma.id,
          content: 'Same here! Bring your acoustic guitar if you have one.',
          sentAt: new Date(now - 20 * 60 * 1000),
        },
        {
          senderId: users.karim.id,
          receiverId: users.maya.id,
          content: 'Hi Maya, when should we schedule the Public Speaking session?',
          sentAt: new Date(now - 10 * 60 * 1000),
        },
      ],
    });

    // 9. Sample reports
    await tx.report.createMany({
      data: [
        {
          submitterId: users.nour.id,
          reportedUserId: null,
          type: REPORT_TYPES.BUG,
          subject: 'Calendar picker hint on small screens',
          description: 'The datetime picker label wraps onto two lines on 360px mobile screens.',
          status: REPORT_STATUSES.OPEN,
        },
        {
          submitterId: users.omar.id,
          reportedUserId: null,
          type: REPORT_TYPES.OTHER,
          subject: 'Add dark mode toggle in future update',
          description: 'It would be nice to have an optional dark theme for evening sessions.',
          status: REPORT_STATUSES.IN_REVIEW,
        },
        {
          submitterId: users.maya.id,
          reportedUserId: users.karim.id,
          type: REPORT_TYPES.USER,
          subject: 'Reschedule confirmation question',
          description: 'Just checking if a previously declined slot notice was sent properly.',
          status: REPORT_STATUSES.RESOLVED,
        },
      ],
    });

    return users;
  });

  console.log('Seeded 5 demo users and interactive sample data:');
  for (const def of DEMO_USERS) {
    console.log(`  - ${def.name}: ${def.email} (password: ${demoPassword})`);
  }
  return { skipped: false, userCount: Object.keys(result).length };
}

if (require.main === module) {
  seedDemoData()
    .catch((err) => {
      console.error('Demo seed failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  DEMO_USERS,
  seedDemoData,
};
