const requestService = require('../services/requestService');
const AppError = require('../utils/AppError');
const { POINTS_PER_SESSION } = require('../config/constants');

/**
 * Render the Swap Requests page with real requests and active peer options.
 */
async function renderRequestsPage(
  req,
  res,
  next,
  { statusCode = 200, errorMessage = null, formData = {} } = {}
) {
  try {
    const userId = req.session.user.id;
    const searchQuery = req.validated?.query?.q || '';
    const { requests, peerOptions, myOfferedSkills, pointsBalance } =
      await requestService.getRequestsPageData(userId, searchQuery);

    const swapRequests = requests.map((r) => ({
      id: r.id,
      partnerId: r.senderId === userId ? r.receiverId : r.senderId,
      partnerName: r.senderId === userId ? r.receiver.name : r.sender.name,
      wantedSkill: r.wantedSkill.skillName,
      offeredSkill: r.offeredSkill ? r.offeredSkill.skillName : null,
      direction: r.senderId === userId ? 'outgoing' : 'incoming',
      status: r.status,
      senderId: r.senderId,
      receiverId: r.receiverId,
    }));

    const locals = {
      title: 'Swap Requests',
      useSidebar: true,
      hideFooter: true,
      activeNav: 'requests',
      bodyClass: 'bg-[#F4F7FC] text-slate-800 antialiased min-h-screen',
      swapRequests,
      peerOptions,
      myOfferedSkills,
      pointsBalance,
      pointsPerSession: POINTS_PER_SESSION,
      searchQuery,
      formData,
    };

    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }

    return res.status(statusCode).render('pages/requests', locals);
  } catch (err) {
    return next(err);
  }
}

async function listRequests(req, res, next) {
  return renderRequestsPage(req, res, next);
}

async function sendRequest(req, res, next) {
  try {
    await requestService.sendRequest(req.session.user.id, req.validatedBody);
    req.flash('success', 'Swap request sent.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/requests');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode !== 403) {
      return renderRequestsPage(req, res, next, {
        statusCode: err.statusCode,
        errorMessage: err.message,
        formData: req.body || {},
      });
    }
    return next(err);
  }
}

async function handleRequestTransition(req, res, next, serviceFn, successMessage) {
  try {
    await serviceFn(req.session.user.id, req.validated.params.id);
    req.flash('success', successMessage);
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/requests');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderRequestsPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

async function acceptRequest(req, res, next) {
  return handleRequestTransition(
    req,
    res,
    next,
    requestService.acceptRequest,
    'Swap request accepted. You can now schedule it on the Sessions page.'
  );
}

async function declineRequest(req, res, next) {
  return handleRequestTransition(
    req,
    res,
    next,
    requestService.declineRequest,
    'Swap request declined.'
  );
}

async function cancelRequest(req, res, next) {
  return handleRequestTransition(
    req,
    res,
    next,
    requestService.cancelRequest,
    'Swap request cancelled.'
  );
}

module.exports = {
  renderRequestsPage,
  listRequests,
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
};
