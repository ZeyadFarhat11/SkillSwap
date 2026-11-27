const prisma = require('./prisma');

/**
 * Persist a new report row.
 */
async function create(data) {
  return prisma.report.create({ data });
}

/**
 * List reports submitted by a user, newest first.
 */
async function findBySubmitterId(submitterId) {
  return prisma.report.findMany({
    where: { submitterId },
    include: { reportedUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { create, findBySubmitterId };
