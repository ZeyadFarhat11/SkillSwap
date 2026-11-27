const ratingService = require('../services/ratingService');

/**
 * POST /sessions/:id/rating
 * Submit a star rating + optional comment for a completed session.
 */
async function submitRating(req, res, next) {
  try {
    const sessionId = req.validated.params.id;
    const reviewerId = req.session.user.id;
    const { stars, comment } = req.validated.body;

    await ratingService.submitRating(sessionId, reviewerId, { stars, comment });

    req.flash('success', 'Your review has been submitted. Thank you!');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/sessions');
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { submitRating };
