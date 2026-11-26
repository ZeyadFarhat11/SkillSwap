const express = require('express');
const skillController = require('../controllers/skillController');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { addUserSkillSchema, userSkillIdParamSchema } = require('../validators/skillValidator');

const router = express.Router();

router.get('/skills', requireAuth, skillController.showSkills);

router.post(
  '/skills/mine',
  requireAuth,
  validate(addUserSkillSchema, {
    onError: (req, res, next, { firstMessage, formData }) =>
      skillController.renderSkillsPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
        formData,
      }),
  }),
  skillController.addSkill
);

router.post(
  '/skills/mine/:id/delete',
  requireAuth,
  validate(userSkillIdParamSchema, { source: 'params' }),
  skillController.deleteSkill
);

module.exports = router;
