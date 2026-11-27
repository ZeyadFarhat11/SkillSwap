const adminService = require('../services/adminService');
const settingsService = require('../services/settingsService');
const AppError = require('../utils/AppError');

async function renderUsersPage(
  req,
  res,
  next,
  { statusCode = 200, errorMessage = null } = {}
) {
  try {
    const q = req.validated?.query?.q || (typeof req.query?.q === 'string' ? req.query.q : '');
    const status =
      req.validated?.query?.status || (typeof req.query?.status === 'string' ? req.query.status : '');
    const { summary, users, filters } = await adminService.getUsersPageData({ q, status });
    const locals = {
      title: 'User Management',
      useSidebar: true,
      isAdminLayout: true,
      hideFooter: true,
      activeNav: 'admin-users',
      searchAction: '/admin/users',
      searchTableId: 'adminUsersTable',
      bodyClass: 'bg-[#f8fafc] min-h-screen antialiased text-slate-700',
      summary,
      users,
      filters,
    };
    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }
    return res.status(statusCode).render('pages/adminUsers', locals);
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res, next) {
  return renderUsersPage(req, res, next);
}

async function suspendUser(req, res, next) {
  try {
    await adminService.suspendUser(req.session.user.id, req.validated.params.id);
    req.flash('success', 'User account suspended.');
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/users');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderUsersPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

async function reactivateUser(req, res, next) {
  try {
    await adminService.reactivateUser(req.validated.params.id);
    req.flash('success', 'User account reactivated.');
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/users');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderUsersPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

async function adjustUserPoints(req, res, next) {
  try {
    const targetUserId = req.validated.params.id;
    const { amount } = req.validated.body;
    await adminService.adjustUserPoints(targetUserId, amount);
    const signLabel = amount > 0 ? `+${amount}` : String(amount);
    req.flash('success', `Adjusted user points by ${signLabel}.`);
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/users');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderUsersPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

async function renderSkillsPage(
  req,
  res,
  next,
  { statusCode = 200, errorMessage = null } = {}
) {
  try {
    const q = req.validated?.query?.q || (typeof req.query?.q === 'string' ? req.query.q : '');
    const status =
      req.validated?.query?.status || (typeof req.query?.status === 'string' ? req.query.status : '');
    const { summary, skills, filters } = await adminService.getSkillsPageData({ q, status });
    const locals = {
      title: 'Skill Management',
      useSidebar: true,
      isAdminLayout: true,
      hideFooter: true,
      activeNav: 'admin-skills',
      searchAction: '/admin/skills',
      searchTableId: 'adminSkillsTable',
      bodyClass: 'min-h-screen text-[#141A29] antialiased bg-[#F8FAFC]',
      summary,
      skills,
      filters,
    };
    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }
    return res.status(statusCode).render('pages/adminSkills', locals);
  } catch (err) {
    return next(err);
  }
}

async function listSkills(req, res, next) {
  return renderSkillsPage(req, res, next);
}

async function createSkill(req, res, next) {
  try {
    await adminService.createSkill(req.validated.body.skillName);
    req.flash('success', 'Skill added.');
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/skills');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderSkillsPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

async function removeSkill(req, res, next) {
  try {
    await adminService.removeSkill(req.validated.params.id);
    req.flash('success', 'Skill removed.');
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/skills');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderSkillsPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

async function handleSkillAction(req, res, next, serviceFn, successMessage) {
  try {
    await serviceFn(req.validated.params.id);
    req.flash('success', successMessage);
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/skills');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderSkillsPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

async function approveSkill(req, res, next) {
  return handleSkillAction(req, res, next, adminService.approveSkill, 'Skill approved.');
}

async function rejectSkill(req, res, next) {
  return handleSkillAction(req, res, next, adminService.rejectSkill, 'Skill rejected.');
}

async function listSessions(req, res, next) {
  try {
    const q = req.validated?.query?.q || (typeof req.query?.q === 'string' ? req.query.q : '');
    const status =
      req.validated?.query?.status || (typeof req.query?.status === 'string' ? req.query.status : '');
    const { summary, sessions, filters } = await adminService.getSessionsPageData({ q, status });
    return res.render('pages/adminSessions', {
      title: 'Session Management',
      useSidebar: true,
      isAdminLayout: true,
      hideFooter: true,
      activeNav: 'admin-sessions',
      searchAction: '/admin/sessions',
      searchTableId: 'adminSessionsTable',
      bodyClass: 'text-slate-700 antialiased min-h-screen bg-[#f8fafc]',
      summary,
      sessions,
      filters,
    });
  } catch (err) {
    return next(err);
  }
}

async function renderSettingsPage(
  req,
  res,
  next,
  { statusCode = 200, errorMessage = null, formOverrides = null } = {}
) {
  try {
    const currentSettings = await settingsService.getPlatformSettings();
    const settings = formOverrides ? { ...currentSettings, ...formOverrides } : currentSettings;
    const locals = {
      title: 'Admin Settings',
      useSidebar: true,
      isAdminLayout: true,
      hideFooter: true,
      activeNav: 'admin-settings',
      bodyClass: 'min-h-screen font-sans antialiased text-slate-800 bg-[#F8FAFC]',
      settings,
    };
    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }
    return res.status(statusCode).render('pages/adminSettings', locals);
  } catch (err) {
    return next(err);
  }
}

async function getSettingsPage(req, res, next) {
  return renderSettingsPage(req, res, next);
}

async function updateGeneralSettings(req, res, next) {
  try {
    await settingsService.updateGeneralSettings(req.validated.body);
    req.flash('success', 'General platform information updated.');
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/settings');
    });
  } catch (err) {
    return next(err);
  }
}

async function updatePreferenceSettings(req, res, next) {
  try {
    await settingsService.updatePreferenceSettings(req.validated.body);
    req.flash('success', 'Platform preferences updated.');
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/settings');
    });
  } catch (err) {
    return next(err);
  }
}

async function renderReportsPage(
  req,
  res,
  next,
  { statusCode = 200, errorMessage = null } = {}
) {
  try {
    const q = req.validated?.query?.q || (typeof req.query?.q === 'string' ? req.query.q : '');
    const status =
      req.validated?.query?.status || (typeof req.query?.status === 'string' ? req.query.status : '');
    const { summary, reports, filters } = await adminService.getReportsPageData({ q, status });
    const locals = {
      title: 'Reports Management',
      useSidebar: true,
      isAdminLayout: true,
      hideFooter: true,
      activeNav: 'admin-reports',
      searchAction: '/admin/reports',
      searchTableId: 'adminReportsTable',
      bodyClass: 'min-h-screen text-[#141A29] antialiased bg-[#F8FAFC]',
      summary,
      reports,
      filters,
    };
    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }
    return res.status(statusCode).render('pages/adminReports', locals);
  } catch (err) {
    return next(err);
  }
}

async function listReports(req, res, next) {
  return renderReportsPage(req, res, next);
}

async function updateReportStatus(req, res, next) {
  try {
    await adminService.updateReportStatus(req.validated.params.id, req.validated.body.status);
    req.flash('success', 'Report status updated.');
    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/admin/reports');
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return renderReportsPage(req, res, next, {
        statusCode: 400,
        errorMessage: err.message,
      });
    }
    return next(err);
  }
}

module.exports = {
  renderUsersPage,
  listUsers,
  suspendUser,
  reactivateUser,
  adjustUserPoints,
  renderSkillsPage,
  listSkills,
  createSkill,
  removeSkill,
  approveSkill,
  rejectSkill,
  listSessions,
  renderSettingsPage,
  getSettingsPage,
  updateGeneralSettings,
  updatePreferenceSettings,
  renderReportsPage,
  listReports,
  updateReportStatus,
};
