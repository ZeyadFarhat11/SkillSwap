const prisma = require('./prisma');

/**
 * List all availability slots for a user sorted by day and start time.
 */
async function listUserAvailability(userId) {
  return prisma.availability.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

/**
 * List availability slots for a user on a specific day of week (0..6).
 */
async function listUserAvailabilityForDay(userId, dayOfWeek) {
  return prisma.availability.findMany({
    where: { userId, dayOfWeek },
    orderBy: { startTime: 'asc' },
  });
}

/**
 * Find an availability slot by primary key ID.
 */
async function findAvailabilityById(id) {
  return prisma.availability.findUnique({ where: { id } });
}

/**
 * Create a new availability slot.
 */
async function createAvailability({ userId, dayOfWeek, startTime, endTime }) {
  return prisma.availability.create({
    data: { userId, dayOfWeek, startTime, endTime },
  });
}

/**
 * Delete an availability slot by ID.
 */
async function deleteAvailability(id) {
  return prisma.availability.delete({ where: { id } });
}

module.exports = {
  listUserAvailability,
  listUserAvailabilityForDay,
  findAvailabilityById,
  createAvailability,
  deleteAvailability,
};
