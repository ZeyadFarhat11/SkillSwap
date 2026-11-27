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

/**
 * Find a single report by primary key ID.
 */
async function findById(id) {
  return prisma.report.findUnique({ where: { id } });
}

/**
 * List all reports for admin moderation, newest first.
 */
async function listAllReportsForAdmin() {
  return prisma.report.findMany({
    include: {
      submitter: { select: { id: true, name: true, email: true } },
      reportedUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update a report's moderation status.
 */
async function updateReportStatus(id, status) {
  return prisma.report.update({
    where: { id },
    data: { status },
  });
}

module.exports = {
  create,
  findBySubmitterId,
  findById,
  listAllReportsForAdmin,
  updateReportStatus,
};
