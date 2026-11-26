const swapRequestModel = require('../models/swapRequestModel');
const userModel = require('../models/userModel');
const skillModel = require('../models/skillModel');
const AppError = require('../utils/AppError');
const {
  SWAP_STATUSES,
  SKILL_TYPES,
  USER_STATUSES,
  POINTS_PER_SESSION,
} = require('../config/constants');

/**
 * Send a new swap request.
 *
 * Rules enforced:
 * - No self-requests.
 * - Receiver must exist and be active.
 * - Receiver must offer the wanted skill (approved).
 * - If mutual, sender must offer the offered skill (approved).
 * - No duplicate pending request for the same pair and skill combo.
 * - One-way requests require the sender to have >= POINTS_PER_SESSION balance.
 */
async function sendRequest(senderId, { receiverId, wantedSkillId, offeredSkillId }) {
  if (senderId === receiverId) {
    throw new AppError('You cannot send a swap request to yourself.', 400);
  }

  const receiver = await userModel.findById(receiverId);
  if (!receiver) {
    throw new AppError('Receiver not found.', 404);
  }
  if (receiver.status !== USER_STATUSES.ACTIVE) {
    throw new AppError('You can only send requests to active users.', 400);
  }

  const receiverOffersSkill = await skillModel.findApprovedUserSkill(
    receiverId,
    wantedSkillId,
    SKILL_TYPES.OFFER
  );
  if (!receiverOffersSkill) {
    throw new AppError('The receiver does not offer this skill.', 400);
  }

  if (offeredSkillId) {
    const senderOffersSkill = await skillModel.findApprovedUserSkill(
      senderId,
      offeredSkillId,
      SKILL_TYPES.OFFER
    );
    if (!senderOffersSkill) {
      throw new AppError('You do not offer this skill.', 400);
    }
  }

  const duplicate = await swapRequestModel.findDuplicatePending(
    senderId,
    receiverId,
    wantedSkillId,
    offeredSkillId
  );
  if (duplicate) {
    throw new AppError('You already have a pending request for this swap.', 409);
  }

  if (!offeredSkillId) {
    const sender = await userModel.findById(senderId);
    if (!sender || sender.pointsBalance < POINTS_PER_SESSION) {
      throw new AppError(
        `You need at least ${POINTS_PER_SESSION} points for a one-way request.`,
        400
      );
    }
  }

  return swapRequestModel.create({
    senderId,
    receiverId,
    wantedSkillId,
    offeredSkillId: offeredSkillId || null,
  });
}

async function transitionPendingRequest({ userId, requestId, actorField, denyMessage, nextStatus }) {
  const request = await swapRequestModel.findById(requestId);
  if (!request) {
    throw new AppError('Swap request not found.', 404);
  }
  if (request[actorField] !== userId) {
    throw new AppError(denyMessage, 403);
  }
  if (request.status !== SWAP_STATUSES.PENDING) {
    throw new AppError('This request is no longer pending.', 400);
  }

  return swapRequestModel.updateStatus(requestId, nextStatus);
}

/**
 * Accept a pending swap request (receiver only).
 */
async function acceptRequest(userId, requestId) {
  return transitionPendingRequest({
    userId,
    requestId,
    actorField: 'receiverId',
    denyMessage: 'Only the receiver can accept this request.',
    nextStatus: SWAP_STATUSES.ACCEPTED,
  });
}

/**
 * Decline a pending swap request (receiver only).
 */
async function declineRequest(userId, requestId) {
  return transitionPendingRequest({
    userId,
    requestId,
    actorField: 'receiverId',
    denyMessage: 'Only the receiver can decline this request.',
    nextStatus: SWAP_STATUSES.DECLINED,
  });
}

/**
 * Cancel a pending swap request (sender only).
 */
async function cancelRequest(userId, requestId) {
  return transitionPendingRequest({
    userId,
    requestId,
    actorField: 'senderId',
    denyMessage: 'Only the sender can cancel this request.',
    nextStatus: SWAP_STATUSES.CANCELLED,
  });
}

/**
 * List all swap requests where user is sender or receiver.
 */
async function listForUser(userId) {
  return swapRequestModel.findByUserId(userId);
}

/**
 * Load all data needed to render the Swap Requests page.
 */
async function getRequestsPageData(userId) {
  const [requests, peers, mySkills, currentUser] = await Promise.all([
    swapRequestModel.findByUserId(userId),
    userModel.findActivePeersWithOfferedSkills(userId),
    skillModel.listUserSkills(userId),
    userModel.findById(userId),
  ]);

  const myOfferedSkills = mySkills
    .filter((entry) => entry.type === SKILL_TYPES.OFFER)
    .map((entry) => ({
      skillId: entry.skillId,
      skillName: entry.skill.skillName,
      level: entry.level,
    }));

  const peerOptions = peers.map((peer) => {
    const approvedEntries = peer.userSkills || [];
    const offeredSkills = approvedEntries
      .filter((entry) => entry.type === SKILL_TYPES.OFFER)
      .map((entry) => ({
        skillId: entry.skillId,
        skillName: entry.skill.skillName,
        level: entry.level,
      }));
    const wantedSkills = approvedEntries
      .filter((entry) => entry.type === SKILL_TYPES.WANT)
      .map((entry) => ({
        skillId: entry.skillId,
        skillName: entry.skill.skillName,
        level: entry.level,
      }));
    const ratings = peer.receivedRatings || [];
    const averageRating = ratings.length
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
      : null;

    return {
      id: peer.id,
      name: peer.name,
      bio: peer.bio || '',
      avatarPath: peer.avatarPath ? String(peer.avatarPath).replace(/\\/g, '/').replace(/^\/+/, '') : null,
      rating: averageRating,
      offeredSkills,
      wantedSkills,
    };
  });

  return {
    requests,
    peerOptions,
    myOfferedSkills,
    pointsBalance: currentUser ? currentUser.pointsBalance : 0,
  };
}

/**
 * Get a single swap request (participants only).
 */
async function getRequest(userId, requestId) {
  const request = await swapRequestModel.findById(requestId);
  if (!request) {
    throw new AppError('Swap request not found.', 404);
  }
  if (request.senderId !== userId && request.receiverId !== userId) {
    throw new AppError('You are not a participant of this request.', 403);
  }
  return request;
}

module.exports = {
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  listForUser,
  getRequestsPageData,
  getRequest,
};
