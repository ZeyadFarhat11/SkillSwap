const ratingModel = require('../models/ratingModel');
const sessionModel = require('../models/sessionModel');
const AppError = require('../utils/AppError');
const { SESSION_STATUSES } = require('../config/constants');

/**
 * Submit a rating for a completed session.
 *
 * Rules:
 * - Session must be completed.
 * - Reviewer must be a participant (instructor or learner).
 * - Reviewer can only rate once per session (UNIQUE guard in DB + pre-check).
 * - revieweeId is always the OTHER participant.
 * - Stars must be 1–5.
 */
async function submitRating(sessionId, reviewerId, { stars, comment }) {
  const session = await sessionModel.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404);
  }
  if (session.status !== SESSION_STATUSES.COMPLETED) {
    throw new AppError('You can only rate a completed session.', 400);
  }

  const isInstructor = session.instructorId === reviewerId;
  const isLearner = session.learnerId === reviewerId;
  if (!isInstructor && !isLearner) {
    throw new AppError('Only session participants can submit a rating.', 403);
  }

  const revieweeId = isInstructor ? session.learnerId : session.instructorId;

  const existing = await ratingModel.findBySessionAndReviewer(sessionId, reviewerId);
  if (existing) {
    throw new AppError('You have already rated this session.', 409);
  }

  if (stars < 1 || stars > 5) {
    throw new AppError('Stars must be between 1 and 5.', 400);
  }

  const normalizedComment = typeof comment === 'string' && comment.trim() ? comment.trim() : null;

  try {
    return await ratingModel.create({
      sessionId,
      reviewerId,
      revieweeId,
      stars,
      comment: normalizedComment,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new AppError('You have already rated this session.', 409);
    }
    throw err;
  }
}

/**
 * Check whether the user has already rated the given session.
 */
async function hasUserReviewedSession(sessionId, reviewerId) {
  const existing = await ratingModel.findBySessionAndReviewer(sessionId, reviewerId);
  return Boolean(existing);
}

/**
 * Load all received ratings for a user, formatted for the reviews partial.
 * Also computes the average rating.
 */
async function getReceivedReviews(userId) {
  const ratings = await ratingModel.findByRevieweeId(userId);

  const reviews = ratings.map((r) => ({
    reviewerName: r.reviewer.name,
    stars: r.stars,
    comment: r.comment || null,
    dateLabel: new Date(r.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  }));

  const averageRating =
    reviews.length > 0
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
      : null;

  return { reviews, averageRating };
}

module.exports = { submitRating, hasUserReviewedSession, getReceivedReviews };
