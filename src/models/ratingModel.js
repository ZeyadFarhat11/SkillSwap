const prisma = require('./prisma');

/**
 * Create a new rating row.
 */
async function create(data) {
  return prisma.rating.create({ data });
}

/**
 * Find an existing rating by session + reviewer (for duplicate guard).
 */
async function findBySessionAndReviewer(sessionId, reviewerId) {
  return prisma.rating.findFirst({ where: { sessionId, reviewerId } });
}

/**
 * Find all ratings where the given user is the reviewee, newest first.
 * Includes reviewer name for display.
 */
async function findByRevieweeId(revieweeId) {
  return prisma.rating.findMany({
    where: { revieweeId },
    include: { reviewer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { create, findBySessionAndReviewer, findByRevieweeId };
