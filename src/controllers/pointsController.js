const pointsService = require('../services/pointsService');
const { STARTER_POINTS, POINTS_PER_SESSION } = require('../config/constants');

/**
 * GET /points
 */
async function showPoints(req, res, next) {
  try {
    const { wallet, transactions } = await pointsService.getPointsPageData(req.session.user.id);
    return res.render('pages/points', {
      title: 'Points Wallet',
      useSidebar: true,
      hideFooter: true,
      activeNav: 'points',
      bodyClass: 'min-h-screen bg-[#f4f7fb] text-slate-800 antialiased',
      starterPoints: STARTER_POINTS,
      pointsPerSession: POINTS_PER_SESSION,
      wallet,
      transactions,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { showPoints };
