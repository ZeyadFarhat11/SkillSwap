const sessionModel = require('../models/sessionModel');
const swapRequestModel = require('../models/swapRequestModel');
const availabilityModel = require('../models/availabilityModel');
const AppError = require('../utils/AppError');
const { timeToMinutes } = require('../utils/time');
const {
  SESSION_STATUSES,
  SWAP_STATUSES,
  POINTS_PER_SESSION,
} = require('../config/constants');

/**
 * Check whether a dateTime falls inside at least one of the user's availability slots.
 * Compares day-of-week and UTC time (half-open: start <= time < end).
 */
function dateTimeFallsInAvailability(dateTime, availabilitySlots) {
  const dayOfWeek = dateTime.getUTCDay();
  const totalMinutes = dateTime.getUTCHours() * 60 + dateTime.getUTCMinutes();

  return availabilitySlots.some((slot) => {
    if (slot.dayOfWeek !== dayOfWeek) return false;
    const startMin = timeToMinutes(slot.startTime);
    const endMin = timeToMinutes(slot.endTime);
    return totalMinutes >= startMin && totalMinutes < endMin;
  });
}

/**
 * Schedule session(s) for an accepted swap request.
 *
 * Creates one session for one-way requests, two sessions for mutual swaps.
 * dateTime must fall inside both users' availability, and the request must not
 * already have scheduled/completed sessions.
 */
async function scheduleSession(userId, { swapRequestId, dateTime }) {
  const request = await swapRequestModel.findById(swapRequestId);
  if (!request) {
    throw new AppError('Swap request not found.', 404);
  }
  if (request.senderId !== userId && request.receiverId !== userId) {
    throw new AppError('You are not a participant of this request.', 403);
  }
  if (request.status !== SWAP_STATUSES.ACCEPTED) {
    throw new AppError('Sessions can only be scheduled for accepted requests.', 400);
  }

  const activeSessions = await sessionModel.findActiveBySwapRequestId(swapRequestId);
  if (activeSessions.length > 0) {
    throw new AppError('Sessions have already been scheduled for this swap request.', 409);
  }

  const [senderAvailability, receiverAvailability] = await Promise.all([
    availabilityModel.listUserAvailability(request.senderId),
    availabilityModel.listUserAvailability(request.receiverId),
  ]);

  if (!dateTimeFallsInAvailability(dateTime, senderAvailability)) {
    throw new AppError(
      "The selected time does not fall within the sender's availability.",
      400
    );
  }
  if (!dateTimeFallsInAvailability(dateTime, receiverAvailability)) {
    throw new AppError(
      "The selected time does not fall within the receiver's availability.",
      400
    );
  }

  const sessionsData = [
    {
      swapRequestId,
      instructorId: request.receiverId,
      learnerId: request.senderId,
      skillId: request.wantedSkillId,
      dateTime,
    },
  ];

  if (request.offeredSkillId) {
    sessionsData.push({
      swapRequestId,
      instructorId: request.senderId,
      learnerId: request.receiverId,
      skillId: request.offeredSkillId,
      dateTime,
    });
  }

  return sessionModel.createBatch(sessionsData);
}

/**
 * Cancel a scheduled session (participants only).
 */
async function cancelSession(userId, sessionId) {
  const session = await sessionModel.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404);
  }
  if (session.instructorId !== userId && session.learnerId !== userId) {
    throw new AppError('You are not a participant of this session.', 403);
  }
  if (session.status !== SESSION_STATUSES.SCHEDULED) {
    throw new AppError('Only scheduled sessions can be cancelled.', 400);
  }

  return sessionModel.updateStatus(sessionId, SESSION_STATUSES.CANCELLED);
}

/**
 * Complete a session (participants only, after dateTime has passed).
 *
 * For one-way requests: transfers POINTS_PER_SESSION from learner to instructor
 * in a single transaction with row locks and balance re-check.
 * When all sessions of a request are completed, the request status becomes 'completed'.
 */
async function completeSession(userId, sessionId) {
  const session = await sessionModel.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404);
  }
  if (session.instructorId !== userId && session.learnerId !== userId) {
    throw new AppError('You are not a participant of this session.', 403);
  }
  if (session.status !== SESSION_STATUSES.SCHEDULED) {
    throw new AppError('Only scheduled sessions can be completed.', 400);
  }
  if (new Date() < session.dateTime) {
    throw new AppError('Cannot complete a session before its scheduled time.', 400);
  }

  const isOneWay = !session.swapRequest.offeredSkillId;

  return sessionModel.completeSessionTx({
    sessionId,
    isOneWay,
    pointsPerSession: POINTS_PER_SESSION,
  });
}

/**
 * List all sessions where user is instructor or learner.
 */
async function listForUser(userId) {
  return sessionModel.findByUserId(userId);
}

/**
 * Load all data needed to render the Sessions page (sessions list, pending count,
 * and accepted swaps that still need scheduling).
 */
async function getSessionsPageData(userId) {
  const [sessions, acceptedRequests, pendingRequestsCount] = await Promise.all([
    sessionModel.findByUserId(userId),
    swapRequestModel.findAcceptedByUserId(userId),
    swapRequestModel.countPendingForUser(userId),
  ]);

  const schedulableRequests = acceptedRequests.filter((req) => {
    const hasActive = (req.sessions || []).some(
      (s) => s.status === SESSION_STATUSES.SCHEDULED || s.status === SESSION_STATUSES.COMPLETED
    );
    return !hasActive;
  });

  return {
    sessions,
    schedulableRequests,
    pendingRequestsCount,
  };
}

/**
 * Get a single session (participants only).
 */
async function getSession(userId, sessionId) {
  const session = await sessionModel.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404);
  }
  if (session.instructorId !== userId && session.learnerId !== userId) {
    throw new AppError('You are not a participant of this session.', 403);
  }
  return session;
}

module.exports = {
  scheduleSession,
  cancelSession,
  completeSession,
  listForUser,
  getSessionsPageData,
  getSession,
  dateTimeFallsInAvailability,
};
