const env = require('./env');

module.exports = {
  STARTER_POINTS: env.STARTER_POINTS,
  POINTS_PER_SESSION: env.POINTS_PER_SESSION,
  MAX_UPLOAD_MB: env.MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES: env.MAX_UPLOAD_MB * 1024 * 1024,
  AVATAR_SIZE: 400,
  BCRYPT_ROUNDS: 12,
  MIN_PASSWORD_LENGTH: 8,
  ML_TIMEOUT_MS: 2000,

  USER_ROLES: {
    USER: 'user',
    ADMIN: 'admin',
  },
  USER_STATUSES: {
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
  },
  SKILL_STATUSES: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  },
  SKILL_TYPES: {
    OFFER: 'offer',
    WANT: 'want',
  },
  SKILL_LEVELS: {
    BEGINNER: 'beginner',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced',
  },
  SWAP_STATUSES: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
  },
  SESSION_STATUSES: {
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  POINTS_TYPES: {
    BONUS: 'bonus',
    EARN: 'earn',
    SPEND: 'spend',
    ADJUSTMENT: 'adjustment',
  },
  REPORT_TYPES: {
    USER: 'user',
    MESSAGE: 'message',
    BUG: 'bug',
    OTHER: 'other',
  },
  REPORT_STATUSES: {
    OPEN: 'open',
    IN_REVIEW: 'in_review',
    RESOLVED: 'resolved',
  },
};
