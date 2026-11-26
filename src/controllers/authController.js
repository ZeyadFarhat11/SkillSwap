const authService = require('../services/authService');
const AppError = require('../utils/AppError');
const { STARTER_POINTS } = require('../config/constants');
const { rotateCsrfToken } = require('../middlewares/csrf');
const { extractSafeFormData } = require('../middlewares/validate');

const REGISTER_VIEW_OPTIONS = {
  view: 'pages/register',
  title: 'Sign Up',
  hideNavbar: true,
  hideFooter: true,
  bodyClass:
    'bg-white text-slate-800 min-h-screen flex flex-col justify-start items-center pt-24 pb-16 px-4 selection:bg-blue-100 selection:text-blue-900 font-sans',
};

const LOGIN_VIEW_OPTIONS = {
  view: 'pages/login',
  title: 'Log In',
  hideNavbar: true,
  hideFooter: true,
  bodyClass:
    'bg-[#f8fafc] text-slate-800 min-h-screen flex flex-col justify-between font-sans selection:bg-blue-100 selection:text-blue-900',
};

/**
 * Regenerate the session to prevent session fixation, attach the user,
 * rotate the CSRF cookie, and redirect home.
 */
function establishUserSession(req, res, next, user, successMessage) {
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
        return res.redirect('/');
      });
    } catch (err) {
      return next(err);
    }
  });
}

function showRegister(_req, res) {
  res.render(REGISTER_VIEW_OPTIONS.view, {
    ...REGISTER_VIEW_OPTIONS,
    errors: {},
    formData: {},
  });
}

async function register(req, res, next) {
  try {
    const user = await authService.registerUser(req.validatedBody);
    return establishUserSession(
      req,
      res,
      next,
      user,
      `Welcome to SkillSwap! You received ${STARTER_POINTS} starter points.`
    );
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).render(REGISTER_VIEW_OPTIONS.view, {
        ...REGISTER_VIEW_OPTIONS,
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
    return establishUserSession(req, res, next, user, 'Welcome back!');
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
  showRegister,
  register,
  showLogin,
  login,
  logout,
};
