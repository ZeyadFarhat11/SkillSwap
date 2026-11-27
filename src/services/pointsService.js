const userModel = require('../models/userModel');
const pointsModel = require('../models/pointsModel');
const { POINTS_TYPES } = require('../config/constants');

/**
 * Load the points page data for a user:
 * - Current balance
 * - Totals (earned, spent, this-month credit)
 * - Full transaction history, newest first
 */
async function getPointsPageData(userId) {
  const [user, rawTxns] = await Promise.all([
    userModel.findById(userId),
    pointsModel.findTransactionsByUserId(userId),
  ]);

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let totalEarned = 0;
  let totalSpent = 0;
  let thisMonth = 0;

  const transactions = rawTxns.map((tx) => {
    const isAdjustment = tx.type === POINTS_TYPES.ADJUSTMENT;
    const isCredit =
      tx.type === POINTS_TYPES.BONUS ||
      tx.type === POINTS_TYPES.EARN ||
      (isAdjustment && tx.amount >= 0);

    const absAmount = Math.abs(tx.amount);
    if (isCredit) totalEarned += absAmount;
    else totalSpent += absAmount;

    if (isCredit && new Date(tx.createdAt) >= startOfMonth) {
      thisMonth += absAmount;
    }

    let label = 'Points adjustment';
    if (tx.type === POINTS_TYPES.BONUS) {
      label = 'Welcome starter bonus';
    } else if (tx.type === POINTS_TYPES.EARN) {
      const skillName = tx.session?.skill?.skillName || 'session';
      label = `Earned – taught ${skillName}`;
    } else if (tx.type === POINTS_TYPES.SPEND) {
      const skillName = tx.session?.skill?.skillName || 'session';
      label = `Spent – learned ${skillName}`;
    }

    return {
      label,
      type: tx.type,
      dateLabel: new Date(tx.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      amount: absAmount,
      isCredit,
    };
  });

  return {
    wallet: {
      balance: user ? user.pointsBalance : 0,
      totalEarned,
      totalSpent,
      thisMonth,
    },
    transactions,
  };
}

module.exports = { getPointsPageData };
