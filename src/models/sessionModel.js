const prisma = require('./prisma');
const AppError = require('../utils/AppError');
const { SESSION_STATUSES, SWAP_STATUSES, POINTS_TYPES } = require('../config/constants');

const SESSION_INCLUDE = {
  swapRequest: {
    include: { sender: true, receiver: true, wantedSkill: true, offeredSkill: true },
  },
  instructor: true,
  learner: true,
  skill: true,
  ratings: true,
};

async function create(data) {
  return prisma.session.create({ data, include: SESSION_INCLUDE });
}

/**
 * Create one or more sessions atomically inside a single transaction.
 */
async function createBatch(sessionsData) {
  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const data of sessionsData) {
      const record = await tx.session.create({ data, include: SESSION_INCLUDE });
      created.push(record);
    }
    return created;
  });
}

async function findById(id) {
  return prisma.session.findUnique({ where: { id }, include: SESSION_INCLUDE });
}

/**
 * List sessions where the user is instructor or learner, most recent first.
 */
async function findByUserId(userId) {
  return prisma.session.findMany({
    where: { OR: [{ instructorId: userId }, { learnerId: userId }] },
    include: SESSION_INCLUDE,
    orderBy: { dateTime: 'desc' },
  });
}

async function findBySwapRequestId(swapRequestId) {
  return prisma.session.findMany({
    where: { swapRequestId },
  });
}

/**
 * Find non-cancelled sessions already created for a swap request.
 */
async function findActiveBySwapRequestId(swapRequestId) {
  return prisma.session.findMany({
    where: {
      swapRequestId,
      status: { in: [SESSION_STATUSES.SCHEDULED, SESSION_STATUSES.COMPLETED] },
    },
  });
}

async function updateStatus(id, status) {
  return prisma.session.update({
    where: { id },
    data: { status },
    include: SESSION_INCLUDE,
  });
}

/**
 * Complete a session atomically inside one transaction:
 * - Locks the session row (`FOR UPDATE`) and verifies it is still scheduled and past due.
 * - For one-way swaps, locks both user rows in deterministic ID order (`FOR UPDATE`),
 *   re-checks learner balance, transfers points, and inserts both points_transactions rows.
 * - Updates parent swap_request status to 'completed' when all its sessions are completed.
 */
async function completeSessionTx({ sessionId, isOneWay, pointsPerSession, now = new Date() }) {
  return prisma.$transaction(async (tx) => {
    const lockedSessions = await tx.$queryRaw`
      SELECT id, swap_request_id, instructor_id, learner_id, status, date_time
      FROM sessions
      WHERE id = ${sessionId}
      FOR UPDATE
    `;
    const sessionRow = lockedSessions[0];
    if (!sessionRow) {
      throw new AppError('Session not found.', 404);
    }
    if (sessionRow.status !== SESSION_STATUSES.SCHEDULED) {
      throw new AppError('Only scheduled sessions can be completed.', 400);
    }
    if (now < new Date(sessionRow.date_time)) {
      throw new AppError('Cannot complete a session before its scheduled time.', 400);
    }

    const instructorId = Number(sessionRow.instructor_id);
    const learnerId = Number(sessionRow.learner_id);
    const swapRequestId = Number(sessionRow.swap_request_id);

    if (isOneWay) {
      const lockedUsers = await tx.$queryRaw`
        SELECT id, points_balance FROM users
        WHERE id IN (${instructorId}, ${learnerId})
        ORDER BY id ASC
        FOR UPDATE
      `;

      const learnerRow = lockedUsers.find((u) => Number(u.id) === learnerId);
      const instructorRow = lockedUsers.find((u) => Number(u.id) === instructorId);

      if (!learnerRow || !instructorRow) {
        throw new AppError('Participant not found.', 404);
      }

      if (Number(learnerRow.points_balance) < pointsPerSession) {
        throw new AppError(
          `Insufficient points. The learner needs at least ${pointsPerSession} points.`,
          400
        );
      }

      await tx.user.update({
        where: { id: learnerId },
        data: { pointsBalance: { decrement: pointsPerSession } },
      });
      await tx.user.update({
        where: { id: instructorId },
        data: { pointsBalance: { increment: pointsPerSession } },
      });

      await tx.pointsTransaction.createMany({
        data: [
          {
            userId: learnerId,
            sessionId,
            type: POINTS_TYPES.SPEND,
            amount: pointsPerSession,
          },
          {
            userId: instructorId,
            sessionId,
            type: POINTS_TYPES.EARN,
            amount: pointsPerSession,
          },
        ],
      });
    }

    await tx.session.update({
      where: { id: sessionId },
      data: { status: SESSION_STATUSES.COMPLETED },
    });

    const siblingSessions = await tx.session.findMany({
      where: { swapRequestId },
    });
    const hasScheduled = siblingSessions.some((s) => s.status === SESSION_STATUSES.SCHEDULED);
    const hasCompleted = siblingSessions.some((s) => s.status === SESSION_STATUSES.COMPLETED);
    if (!hasScheduled && hasCompleted) {
      await tx.swapRequest.update({
        where: { id: swapRequestId },
        data: { status: SWAP_STATUSES.COMPLETED },
      });
    }

    return tx.session.findUnique({ where: { id: sessionId }, include: SESSION_INCLUDE });
  });
}

module.exports = {
  create,
  createBatch,
  findById,
  findByUserId,
  findBySwapRequestId,
  findActiveBySwapRequestId,
  updateStatus,
  completeSessionTx,
};
