const reportService = require('../services/reportService');
const AppError = require('../utils/AppError');
const { REPORT_TYPES } = require('../config/constants');

const REPORT_TYPE_OPTIONS = [
  { value: REPORT_TYPES.USER, label: 'User behavior or no-show' },
  { value: REPORT_TYPES.MESSAGE, label: 'Inappropriate message' },
  { value: REPORT_TYPES.BUG, label: 'Bug or technical issue' },
  { value: REPORT_TYPES.OTHER, label: 'Other' },
];

/**
 * Render the reports form + user's submitted reports list.
 */
async function renderReportsPage(
  req,
  res,
  next,
  { statusCode = 200, errorMessage = null, fieldErrors = {}, formData = {} } = {}
) {
  try {
    const userId = req.session.user.id;
    const { myReports, reportTargetUsers } = await reportService.getReportsPageData(userId);
    const locals = {
      title: 'Reports',
      useSidebar: true,
      hideFooter: true,
      activeNav: 'reports',
      bodyClass: 'bg-[#F0F4F8] font-sans antialiased text-slate-800 min-h-screen',
      reportTypes: REPORT_TYPE_OPTIONS,
      myReports,
      reportTargetUsers,
      errors: fieldErrors,
      formData,
    };

    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }

    return res.status(statusCode).render('pages/reports', locals);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /reports
 */
async function showReports(req, res, next) {
  const prefillUserId = req.query?.userId ? String(req.query.userId) : '';
  return renderReportsPage(req, res, next, {
    formData: prefillUserId ? { reportedUserId: prefillUserId } : {},
  });
}

/**
 * POST /reports
 */
async function submitReport(req, res, next) {
  try {
    const submitterId = req.session.user.id;
    const { type, subject, description, reportedUserId } = req.validated.body;
    await reportService.submitReport(submitterId, { type, subject, description, reportedUserId });
    req.flash('success', 'Your report has been submitted. We will review it shortly.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/reports');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderReportsPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
        fieldErrors: err.fieldErrors || {},
        formData: req.body || {},
      });
    }
    return next(err);
  }
}

module.exports = { renderReportsPage, showReports, submitReport };
