const { z } = require('zod');
const { SKILL_TYPES, SKILL_LEVELS } = require('../config/constants');

const addUserSkillSchema = z.object({
  skillId: z.coerce.number().int().positive('Please select a valid skill.'),
  type: z.enum([SKILL_TYPES.OFFER, SKILL_TYPES.WANT], {
    errorMap: () => ({ message: 'Skill type must be offer or want.' }),
  }),
  level: z.enum([SKILL_LEVELS.BEGINNER, SKILL_LEVELS.INTERMEDIATE, SKILL_LEVELS.ADVANCED], {
    errorMap: () => ({ message: 'Skill level must be beginner, intermediate, or advanced.' }),
  }),
});

const userSkillIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid skill entry ID.'),
});

module.exports = {
  addUserSkillSchema,
  userSkillIdParamSchema,
};
