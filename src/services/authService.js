const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const AppError = require('../utils/AppError');
const { BCRYPT_ROUNDS, STARTER_POINTS, USER_STATUSES } = require('../config/constants');

/**
 * Strip sensitive credentials before attaching a user to session or views.
 */
function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    pointsBalance: user.pointsBalance,
    avatarPath: user.avatarPath || null,
  };
}

/**
 * Register a new active user with hashed password and starter bonus points.
 */
async function registerUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) {
    throw new AppError('An account with this email already exists.', 409, {
      email: 'An account with this email already exists.',
    });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const user = await userModel.createUserWithStarterPoints({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      starterPoints: STARTER_POINTS,
    });
    return sanitizeUser(user);
  } catch (err) {
    if (err && err.code === 'P2002') {
      throw new AppError('An account with this email already exists.', 409, {
        email: 'An account with this email already exists.',
      });
    }
    throw err;
  }
}

/**
 * Authenticate a user by email and password, rejecting suspended accounts.
 */
async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(normalizedEmail);

  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.status === USER_STATUSES.SUSPENDED) {
    throw new AppError('Your account has been suspended. Please contact support.', 403);
  }

  return sanitizeUser(user);
}

module.exports = {
  sanitizeUser,
  registerUser,
  loginUser,
};
