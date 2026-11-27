const reportModel = require('../models/reportModel');
const userModel = require('../models/userModel');
const AppError = require('../utils/AppError');
const { REPORT_STATUSES } = require('../config/constants');

/**
 * Submit a new report from an authenticated user.
 * Validates optional reportedUserId (no self-report, target user must exist).
 */
async function submitReport(submitterId, { type, subject, description, reportedUserId }) {
  if (reportedUserId !== undefined && reportedUserId !== null) {
    if (reportedUserId === submitterId) {
      throw new AppError('You cannot report yourself.', 400);
    }
    const targetUser = await userModel.findById(reportedUserId);
    if (!targetUser) {
      throw new AppError('Reported user not found.', 404);
    }
  }

  return reportModel.create({
    submitterId,
    type,
    subject: subject.trim(),
    description: description.trim(),
    reportedUserId: reportedUserId || null,
    status: REPORT_STATUSES.OPEN,
  });
}

/**
 * Load data needed to render the Reports page:
 * user's submitted reports and list of active peers for optional targeting.
 */
async function getReportsPageData(submitterId) {
  const [myReports, reportTargetUsers] = await Promise.all([
    reportModel.findBySubmitterId(submitterId),
    userModel.findActiveBasicPeers(submitterId),
  ]);

  return {
    myReports: myReports.map((r) => ({
      id: r.id,
      type: r.type,
      subject: r.subject,
      status: r.status,
      reportedUserName: r.reportedUser ? r.reportedUser.name : null,
      dateLabel: new Date(r.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    })),
    reportTargetUsers,
  };
}

module.exports = { submitReport, getReportsPageData };
