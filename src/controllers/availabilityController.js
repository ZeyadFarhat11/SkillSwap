const availabilityService = require('../services/availabilityService');
const AppError = require('../utils/AppError');
const { DAY_NAMES } = require('../utils/time');

async function renderAvailabilityPage(
  req,
  res,
  next,
  { statusCode = 200, errorMessage = null, fieldErrors = {}, formData = {} } = {}
) {
  try {
    const slots = await availabilityService.listUserAvailability(req.session.user.id);
    const locals = {
      title: 'My Availability',
      activeNav: 'availability',
      hideFooter: true,
      slots,
      dayNames: DAY_NAMES,
      errors: fieldErrors,
      formData,
    };
    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }
    return res.status(statusCode).render('pages/availability', locals);
  } catch (err) {
    return next(err);
  }
}

async function showAvailability(req, res, next) {
  return renderAvailabilityPage(req, res, next);
}

async function addAvailability(req, res, next) {
  try {
    await availabilityService.addAvailabilitySlot(req.session.user.id, req.validatedBody);
    req.flash('success', 'Availability slot added.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/availability');
    });
  } catch (err) {
    if (err instanceof AppError) {
      return renderAvailabilityPage(req, res, next, {
        statusCode: err.statusCode,
        errorMessage: err.message,
        fieldErrors: err.fieldErrors || {},
        formData: req.body || {},
      });
    }
    return next(err);
  }
}

async function deleteAvailability(req, res, next) {
  try {
    await availabilityService.removeAvailabilitySlot(req.session.user.id, req.validated.params.id);
    req.flash('success', 'Availability slot removed.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/availability');
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  renderAvailabilityPage,
  showAvailability,
  addAvailability,
  deleteAvailability,
};
