const notificationModel = require('../models/notificationModel');
const { SWAP_STATUSES, SESSION_STATUSES } = require('../config/constants');

/**
 * Format a compact human-readable relative time label.
 */
function formatTimeAgo(dateValue) {
  const msAgo = Math.max(0, Date.now() - new Date(dateValue).getTime());
  const minutes = Math.floor(msAgo / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a UTC date/time preview for session notifications.
 */
function formatSessionUtcLabel(dateValue) {
  const dt = new Date(dateValue);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const min = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} at ${hh}:${min} UTC`;
}

/**
 * Build a sorted list of notifications from messages, swap requests, sessions, and ratings,
 * omitting entries at or before clearedBeforeIso.
 */
async function getNotificationsForUser(userId, clearedBeforeIso = null) {
  const parsedCleared = clearedBeforeIso ? new Date(clearedBeforeIso) : null;
  const clearedBefore =
    parsedCleared && !Number.isNaN(parsedCleared.getTime()) ? parsedCleared : null;

  const { messages, swapRequests, sessions, ratings } =
    await notificationModel.fetchUserActivitySources(userId, clearedBefore);

  const items = [];

  for (const msg of messages || []) {
    const senderName = msg.sender?.name || 'A peer';
    items.push({
      id: `msg-${msg.id}`,
      category: 'message',
      title: `${senderName} sent you a message`,
      detail: msg.content,
      href: `/messages/${msg.senderId}`,
      timestamp: new Date(msg.sentAt),
    });
  }

  for (const req of swapRequests || []) {
    const skillName = req.wantedSkill?.skillName || 'a skill';
    const ts = new Date(req.updatedAt || req.createdAt);

    if (req.receiverId === userId && req.status === SWAP_STATUSES.PENDING) {
      const senderName = req.sender?.name || 'A peer';
      items.push({
        id: `req-${req.id}-pending`,
        category: 'request',
        title: `${senderName} sent you a swap request for ${skillName}`,
        detail: req.offeredSkillId ? 'Mutual skill swap' : 'One-way points request',
        href: '/requests',
        timestamp: ts,
      });
    } else if (
      req.senderId === userId &&
      (req.status === SWAP_STATUSES.ACCEPTED || req.status === SWAP_STATUSES.DECLINED)
    ) {
      const receiverName = req.receiver?.name || 'Your peer';
      const action = req.status === SWAP_STATUSES.ACCEPTED ? 'accepted' : 'declined';
      items.push({
        id: `req-${req.id}-${req.status}`,
        category: 'request',
        title: `${receiverName} ${action} your swap request for ${skillName}`,
        detail:
          req.status === SWAP_STATUSES.ACCEPTED
            ? 'You can now schedule a session.'
            : 'Browse Swap With to request another peer.',
        href: req.status === SWAP_STATUSES.ACCEPTED ? '/sessions' : '/requests',
        timestamp: ts,
      });
    }
  }

  for (const sess of sessions || []) {
    const partner = sess.instructorId === userId ? sess.learner : sess.instructor;
    const partnerName = partner?.name || 'your partner';
    const skillName = sess.skill?.skillName || 'Skill Session';
    const ts = new Date(sess.updatedAt || sess.createdAt);
    const whenLabel = formatSessionUtcLabel(sess.dateTime);

    let title = `Session scheduled: ${skillName} with ${partnerName}`;
    if (sess.status === SESSION_STATUSES.COMPLETED) {
      title = `Session completed: ${skillName} with ${partnerName}`;
    } else if (sess.status === SESSION_STATUSES.CANCELLED) {
      title = `Session cancelled: ${skillName} with ${partnerName}`;
    }

    items.push({
      id: `sess-${sess.id}-${sess.status}`,
      category: 'session',
      title,
      detail: `Slot: ${whenLabel}`,
      href: '/sessions',
      timestamp: ts,
    });
  }

  for (const rating of ratings || []) {
    const reviewerName = rating.reviewer?.name || 'A peer';
    const skillName = rating.session?.skill?.skillName;
    items.push({
      id: `rating-${rating.id}`,
      category: 'rating',
      title: `${reviewerName} left you a ${rating.stars}-star review`,
      detail: skillName ? `Skill: ${skillName}` : rating.comment || 'View on your profile',
      href: '/profile',
      timestamp: new Date(rating.createdAt),
    });
  }

  return items
    .filter((item) => !clearedBefore || item.timestamp > clearedBefore)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30)
    .map((item) => ({
      ...item,
      timeAgo: formatTimeAgo(item.timestamp),
    }));
}

/**
 * Pick the most recent valid ISO timestamp from seen/cleared watermarks.
 */
function pickLatestWatermark(seenAtIso, clearedAtIso) {
  const candidates = [seenAtIso, clearedAtIso]
    .filter(Boolean)
    .map((v) => new Date(v))
    .filter((d) => !Number.isNaN(d.getTime()));

  if (!candidates.length) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

/**
 * Determine whether the user has unseen notifications newer than seen/cleared watermarks.
 */
async function hasNewNotifications(userId, seenAtIso = null, clearedAtIso = null) {
  const sinceDate = pickLatestWatermark(seenAtIso, clearedAtIso);
  return notificationModel.hasActivitySince(userId, sinceDate);
}

module.exports = { getNotificationsForUser, hasNewNotifications, formatTimeAgo };
