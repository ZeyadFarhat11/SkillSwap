const availabilityModel = require('../models/availabilityModel');
const AppError = require('../utils/AppError');
const {
  DAY_NAMES,
  formatPrismaTime,
  timeStringToPrismaDate,
  timeToMinutes,
} = require('../utils/time');

/**
 * Format a Prisma availability record into view-ready HH:mm strings.
 */
function formatSlot(slot) {
  return {
    id: slot.id,
    userId: slot.userId,
    dayOfWeek: slot.dayOfWeek,
    dayName: DAY_NAMES[slot.dayOfWeek] || `Day ${slot.dayOfWeek}`,
    startTime: formatPrismaTime(slot.startTime),
    endTime: formatPrismaTime(slot.endTime),
  };
}

/**
 * List all availability slots for a user formatted as HH:mm.
 */
async function listUserAvailability(userId) {
  const slots = await availabilityModel.listUserAvailability(userId);
  return slots.map(formatSlot);
}

/**
 * Create a new availability slot after enforcing end > start and no overlap
 * on the same day for the user.
 */
async function addAvailabilitySlot(userId, { dayOfWeek, startTime, endTime }) {
  const newStartMinutes = timeToMinutes(startTime);
  const newEndMinutes = timeToMinutes(endTime);

  if (newEndMinutes <= newStartMinutes) {
    throw new AppError('End time must be after start time.', 400);
  }

  const existingSlots = await availabilityModel.listUserAvailabilityForDay(userId, dayOfWeek);
  const hasOverlap = existingSlots.some((slot) => {
    const existingStart = timeToMinutes(slot.startTime);
    const existingEnd = timeToMinutes(slot.endTime);
    return newStartMinutes < existingEnd && existingStart < newEndMinutes;
  });

  if (hasOverlap) {
    throw new AppError(
      'This time slot overlaps with an existing availability slot on the same day.',
      409
    );
  }

  const created = await availabilityModel.createAvailability({
    userId,
    dayOfWeek,
    startTime: timeStringToPrismaDate(startTime),
    endTime: timeStringToPrismaDate(endTime),
  });

  return formatSlot(created);
}

/**
 * Delete an availability slot owned by the authenticated user.
 */
async function removeAvailabilitySlot(userId, slotId) {
  const slot = await availabilityModel.findAvailabilityById(slotId);
  if (!slot) {
    throw new AppError('Availability slot not found.', 404);
  }
  if (slot.userId !== userId) {
    throw new AppError('You do not have permission to remove this availability slot.', 403);
  }

  await availabilityModel.deleteAvailability(slotId);
}

module.exports = {
  formatPrismaTime,
  formatSlot,
  listUserAvailability,
  addAvailabilitySlot,
  removeAvailabilitySlot,
};
