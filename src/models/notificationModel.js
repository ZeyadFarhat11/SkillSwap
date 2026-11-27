const prisma = require('./prisma');
const { SWAP_STATUSES } = require('../config/constants');

/**
 * Fetch recent messages, swap requests, sessions, and ratings involving userId
 * for building the user's dynamic notifications feed.
 */
async function fetchUserActivitySources(userId, clearedBeforeDate = null) {
  const gtFilter = clearedBeforeDate ? { gt: clearedBeforeDate } : undefined;

  const [messages, swapRequests, sessions, ratings] = await Promise.all([
    prisma.message.findMany({
      where: {
        receiverId: userId,
        ...(gtFilter ? { sentAt: gtFilter } : {}),
      },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { sentAt: 'desc' },
      take: 20,
    }),
    prisma.swapRequest.findMany({
      where: {
        OR: [{ receiverId: userId }, { senderId: userId }],
        ...(gtFilter ? { updatedAt: gtFilter } : {}),
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
        wantedSkill: { select: { skillName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.session.findMany({
      where: {
        OR: [{ instructorId: userId }, { learnerId: userId }],
        ...(gtFilter ? { updatedAt: gtFilter } : {}),
      },
      include: {
        instructor: { select: { id: true, name: true } },
        learner: { select: { id: true, name: true } },
        skill: { select: { skillName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.rating.findMany({
      where: {
        revieweeId: userId,
        ...(gtFilter ? { createdAt: gtFilter } : {}),
      },
      include: {
        reviewer: { select: { id: true, name: true } },
        session: { include: { skill: { select: { skillName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return { messages, swapRequests, sessions, ratings };
}

/**
 * Lightweight check for whether the user has at least one notification item newer than sinceDate.
 */
async function hasActivitySince(userId, sinceDate = null) {
  const gtFilter = sinceDate ? { gt: sinceDate } : undefined;

  const [msg, req, sess, rating] = await Promise.all([
    typeof prisma.message?.findFirst === 'function'
      ? prisma.message.findFirst({
          where: { receiverId: userId, ...(gtFilter ? { sentAt: gtFilter } : {}) },
          select: { id: true },
        })
      : null,
    typeof prisma.swapRequest?.findFirst === 'function'
      ? prisma.swapRequest.findFirst({
          where: {
            OR: [
              { receiverId: userId, status: SWAP_STATUSES.PENDING },
              {
                senderId: userId,
                status: { in: [SWAP_STATUSES.ACCEPTED, SWAP_STATUSES.DECLINED] },
              },
            ],
            ...(gtFilter ? { updatedAt: gtFilter } : {}),
          },
          select: { id: true },
        })
      : null,
    typeof prisma.session?.findFirst === 'function'
      ? prisma.session.findFirst({
          where: {
            OR: [{ instructorId: userId }, { learnerId: userId }],
            ...(gtFilter ? { updatedAt: gtFilter } : {}),
          },
          select: { id: true },
        })
      : null,
    typeof prisma.rating?.findFirst === 'function'
      ? prisma.rating.findFirst({
          where: { revieweeId: userId, ...(gtFilter ? { createdAt: gtFilter } : {}) },
          select: { id: true },
        })
      : null,
  ]);

  return Boolean(msg || req || sess || rating);
}

module.exports = { fetchUserActivitySources, hasActivitySince };
