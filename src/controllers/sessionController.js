const sessionService = require('../services/sessionService');
const AppError = require('../utils/AppError');
const { SESSION_STATUSES } = require('../config/constants');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * Format a session row for the sessions list Pug view.
 */
function formatSessionForView(session, currentUserId) {
  const dt = session.dateTime;
  const isLearner = session.learnerId === currentUserId;
  const partner = isLearner ? session.instructor : session.learner;

  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  const endHour = String((dt.getUTCHours() + 1) % 24).padStart(2, '0');

  return {
    id: session.id,
    partnerId: partner.id,
    partnerName: partner.name,
    skillTitle: session.skill.skillName,
    category: session.skill.skillName,
    roleLabel: isLearner
      ? (session.status === SESSION_STATUSES.COMPLETED ? 'You learned' : 'You will learn')
      : (session.status === SESSION_STATUSES.COMPLETED ? 'You taught' : 'You will teach'),
    month: MONTHS[dt.getUTCMonth()],
    day: String(dt.getUTCDate()),
    weekday: WEEKDAYS[dt.getUTCDay()],
    timeRange: `${hh}:${mm} - ${endHour}:${mm} UTC`,
    status: session.status,
  };
}

async function renderSessionsPage(
  req,
  res,
  next,
  { statusCode = 200, errorMessage = null, formData = {} } = {}
) {
  try {
    const userId = req.session.user.id;
    const { sessions, schedulableRequests, pendingRequestsCount } =
      await sessionService.getSessionsPageData(userId);

    const sessionsList = sessions.map((s) => formatSessionForView(s, userId));

    const stats = {
      upcoming: sessionsList.filter((s) => s.status === SESSION_STATUSES.SCHEDULED).length,
      completed: sessionsList.filter((s) => s.status === SESSION_STATUSES.COMPLETED).length,
      pending: pendingRequestsCount,
    };

    const acceptedSwaps = schedulableRequests.map((r) => {
      const partner = r.senderId === userId ? r.receiver : r.sender;
      const swapMode = r.offeredSkill
        ? `${r.wantedSkill.skillName} <-> ${r.offeredSkill.skillName}`
        : `${r.wantedSkill.skillName} (One-way points)`;
      return {
        id: r.id,
        label: `${partner.name} — ${swapMode}`,
      };
    });

    const locals = {
      title: 'Sessions',
      useSidebar: true,
      hideFooter: true,
      activeNav: 'sessions',
      bodyClass: 'bg-[#F8FAFC] font-sans text-slate-800 antialiased min-h-screen',
      stats,
      sessionsList,
      acceptedSwaps,
      formData,
    };

    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }

    return res.status(statusCode).render('pages/sessions', locals);
  } catch (err) {
    return next(err);
  }
}

async function listSessions(req, res, next) {
  return renderSessionsPage(req, res, next);
}

async function createSession(req, res, next) {
  try {
    await sessionService.scheduleSession(req.session.user.id, req.validatedBody);
    req.flash('success', 'Session scheduled.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/sessions');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode !== 403 && err.statusCode !== 404) {
      return renderSessionsPage(req, res, next, {
        statusCode: err.statusCode,
        errorMessage: err.message,
        formData: req.body || {},
      });
    }
    return next(err);
  }
}

async function handleSessionAction(req, res, next, serviceFn, successMessage) {
  try {
    await serviceFn(req.session.user.id, req.validated.params.id);
    req.flash('success', successMessage);
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/sessions');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderSessionsPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

async function completeSession(req, res, next) {
  return handleSessionAction(
    req,
    res,
    next,
    sessionService.completeSession,
    'Session completed.'
  );
}

async function cancelSession(req, res, next) {
  return handleSessionAction(
    req,
    res,
    next,
    sessionService.cancelSession,
    'Session cancelled.'
  );
}

async function reviewForm(req, res, next) {
  try {
    const session = await sessionService.getSession(
      req.session.user.id,
      req.validated.params.id
    );

    const isLearner = session.learnerId === req.session.user.id;
    const partner = isLearner ? session.instructor : session.learner;

    return res.render('pages/reviewForm', {
      title: 'Leave a Review',
      hideSidebar: true,
      hideFooter: true,
      bodyClass: 'bg-[#F4F7FC] min-h-screen text-slate-800 antialiased flex flex-col justify-between',
      sessionInfo: {
        id: session.id,
        partnerName: partner.name,
        skillName: session.skill.skillName,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  renderSessionsPage,
  listSessions,
  createSession,
  completeSession,
  cancelSession,
  reviewForm,
};
