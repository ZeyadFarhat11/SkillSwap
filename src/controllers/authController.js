const crypto = require('crypto');
const authService = require('../services/authService');
const AppError = require('../utils/AppError');
const { STARTER_POINTS, USER_ROLES } = require('../config/constants');
const { rotateCsrfToken } = require('../middlewares/csrf');
const { extractSafeFormData } = require('../middlewares/validate');

const REGISTER_VIEW_OPTIONS = {
  view: 'pages/register',
  title: 'Sign Up',
  hideSidebar: true,
  hideFooter: true,
  bodyClass:
    'bg-white text-slate-800 min-h-screen flex flex-col justify-start items-center pt-24 pb-16 px-4 selection:bg-blue-100 selection:text-blue-900 font-sans',
};

const LOGIN_VIEW_OPTIONS = {
  view: 'pages/login',
  title: 'Log In',
  hideSidebar: true,
  hideFooter: true,
  bodyClass:
    'bg-[#f8fafc] text-slate-800 min-h-screen flex flex-col justify-between font-sans selection:bg-blue-100 selection:text-blue-900',
};

/**
 * Regenerate the session to prevent session fixation, attach the user,
 * rotate the CSRF cookie, and redirect home.
 */
function establishUserSession(req, res, next, user, successMessage, redirectTo = '/suggestions') {
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      return next(regenErr);
    }
    try {
      req.session.user = user;
      rotateCsrfToken(req, res);
      req.flash('success', successMessage);
      return req.session.save((saveErr) => {
        if (saveErr) {
          return next(saveErr);
        }
        return res.redirect(redirectTo);
      });
    } catch (err) {
      return next(err);
    }
  });
}

function ensureRegistrationsAllowed(req, res, next) {
  if (res.locals.platformSettings && res.locals.platformSettings.allowRegistrations === false) {
    return res.status(403).render(REGISTER_VIEW_OPTIONS.view, {
      ...REGISTER_VIEW_OPTIONS,
      registrationsDisabled: true,
      errors: {},
      formData: extractSafeFormData(req.body),
      flash: {
        error: ['New user registrations are currently disabled by the administrator.'],
        success: [],
        info: [],
      },
    });
  }
  return next();
}

function showRegister(_req, res) {
  const registrationsDisabled = res.locals.platformSettings?.allowRegistrations === false;
  res.render(REGISTER_VIEW_OPTIONS.view, {
    ...REGISTER_VIEW_OPTIONS,
    registrationsDisabled,
    errors: {},
    formData: {},
  });
}

async function register(req, res, next) {
  try {
    const user = await authService.registerUser(req.validatedBody);
    const platformName = res.locals.platformSettings?.platformName || 'SkillSwap';

    if (res.locals.platformSettings?.requireEmailVerification) {
      const token = crypto.randomBytes(16).toString('hex');
      return req.session.regenerate((regenErr) => {
        if (regenErr) {
          return next(regenErr);
        }
        try {
          req.session.pendingEmailVerification = { user, token };
          rotateCsrfToken(req, res);
          return req.session.save((saveErr) => {
            if (saveErr) {
              return next(saveErr);
            }
            return res.redirect('/verify-email');
          });
        } catch (err) {
          return next(err);
        }
      });
    }

    return establishUserSession(
      req,
      res,
      next,
      user,
      `Welcome to ${platformName}! You received ${STARTER_POINTS} starter points.`,
      '/welcome'
    );
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render(REGISTER_VIEW_OPTIONS.view, {
        ...REGISTER_VIEW_OPTIONS,
        registrationsDisabled: res.locals.platformSettings?.allowRegistrations === false,
        errors: err.fieldErrors || {},
        formData: extractSafeFormData(req.body),
        flash: {
          error: [err.message],
          success: [],
          info: [],
        },
      });
    }
    return next(err);
  }
}

function showVerifyEmail(req, res) {
  const pending = req.session?.pendingEmailVerification;
  if (!pending) {
    return res.redirect('/login');
  }
  return res.render('pages/verifyEmail', {
    title: 'Verify Email',
    hideSidebar: true,
    hideFooter: true,
    email: pending.user.email,
    verificationToken: pending.token,
  });
}

function verifyEmail(req, res, next) {
  const pending = req.session?.pendingEmailVerification;
  if (!pending) {
    return res.redirect('/login');
  }

  const submittedToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!submittedToken || submittedToken !== pending.token) {
    return res.status(400).render('pages/verifyEmail', {
      title: 'Verify Email',
      hideSidebar: true,
      hideFooter: true,
      email: pending.user.email,
      verificationToken: pending.token,
      flash: {
        error: ['Invalid verification code. Please check the code and try again.'],
        success: [],
        info: [],
      },
    });
  }

  const platformName = res.locals.platformSettings?.platformName || 'SkillSwap';
  const verifiedUser = pending.user;
  return establishUserSession(
    req,
    res,
    next,
    verifiedUser,
    `Email verified! Welcome to ${platformName}. You received ${STARTER_POINTS} starter points.`,
    '/welcome'
  );
}

function showLogin(_req, res) {
  res.render(LOGIN_VIEW_OPTIONS.view, {
    ...LOGIN_VIEW_OPTIONS,
    errors: {},
    formData: {},
  });
}

async function login(req, res, next) {
  try {
    const user = await authService.loginUser(req.validatedBody);
    const inMaintenance = res.locals.platformSettings?.maintenanceMode === true;
    const redirectTo =
      inMaintenance && user.role === USER_ROLES.ADMIN ? '/admin/users' : '/suggestions';
    return establishUserSession(req, res, next, user, 'Welcome back!', redirectTo);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render(LOGIN_VIEW_OPTIONS.view, {
        ...LOGIN_VIEW_OPTIONS,
        errors: err.fieldErrors || {},
        formData: extractSafeFormData(req.body),
        flash: {
          error: [err.message],
          success: [],
          info: [],
        },
      });
    }
    return next(err);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('skillswap.sid');
    return res.redirect('/login');
  });
}

module.exports = {
  REGISTER_VIEW_OPTIONS,
  LOGIN_VIEW_OPTIONS,
  ensureRegistrationsAllowed,
  showRegister,
  register,
  showVerifyEmail,
  verifyEmail,
  showLogin,
  login,
  logout,
};
