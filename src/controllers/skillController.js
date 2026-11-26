const skillService = require('../services/skillService');
const AppError = require('../utils/AppError');

async function renderSkillsPage(req, res, next, { statusCode = 200, errorMessage = null, formData = {} } = {}) {
  try {
    const data = await skillService.getSkillsPageData(req.session.user.id);
    const locals = {
      title: 'My Skills',
      ...data,
      formData,
    };
    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }
    return res.status(statusCode).render('pages/skills', locals);
  } catch (err) {
    return next(err);
  }
}

async function showSkills(req, res, next) {
  return renderSkillsPage(req, res, next);
}

async function addSkill(req, res, next) {
  try {
    await skillService.addUserSkill(req.session.user.id, req.validatedBody);
    req.flash('success', 'Skill added to your profile.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/skills');
    });
  } catch (err) {
    if (err instanceof AppError) {
      return renderSkillsPage(req, res, next, {
        statusCode: err.statusCode,
        errorMessage: err.message,
        formData: req.body || {},
      });
    }
    return next(err);
  }
}

async function deleteSkill(req, res, next) {
  try {
    await skillService.removeUserSkill(req.session.user.id, req.validated.params.id);
    req.flash('success', 'Skill removed.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/skills');
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  renderSkillsPage,
  showSkills,
  addSkill,
  deleteSkill,
};
