const activeSocketsByUser = new Map();

/**
 * Record a connected socket ID for a user.
 * Returns true if this is the user's first active socket (transitioned offline -> online).
 */
function addUserSocket(userId, socketId) {
  let set = activeSocketsByUser.get(userId);
  const wasOffline = !set || set.size === 0;
  if (!set) {
    set = new Set();
    activeSocketsByUser.set(userId, set);
  }
  set.add(socketId);
  return wasOffline;
}

/**
 * Remove a disconnected socket ID for a user.
 * Returns true if the user now has zero active sockets (transitioned online -> offline).
 */
function removeUserSocket(userId, socketId) {
  const set = activeSocketsByUser.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    activeSocketsByUser.delete(userId);
    return true;
  }
  return false;
}

/**
 * Check whether a user currently has at least one active WebSocket connection.
 */
function isUserOnline(userId) {
  const set = activeSocketsByUser.get(userId);
  return Boolean(set && set.size > 0);
}

/**
 * Clear all presence tracking state (primarily for clean test isolation).
 */
function clearPresence() {
  activeSocketsByUser.clear();
}

module.exports = {
  addUserSocket,
  removeUserSocket,
  isUserOnline,
  clearPresence,
};
