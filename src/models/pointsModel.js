const prisma = require('./prisma');

/**
 * Find all points transactions for a user, newest first, with optional session skill name.
 */
async function findTransactionsByUserId(userId) {
  return prisma.pointsTransaction.findMany({
    where: { userId },
    include: { session: { select: { id: true, skill: { select: { skillName: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { findTransactionsByUserId };
