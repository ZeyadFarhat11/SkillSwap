const { z } = require('zod');

const createRequestSchema = z.object({
  receiverId: z.coerce.number().int().positive('Invalid receiver ID.'),
  wantedSkillId: z.coerce.number().int().positive('Invalid skill ID.'),
  offeredSkillId: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.coerce.number().int().positive('Invalid skill ID.').optional()
  ),
});

const requestIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid request ID.'),
});

const searchRequestQuerySchema = z.object({
  q: z.string().trim().max(100, 'Search query must be 100 characters or fewer.').optional(),
});

module.exports = {
  createRequestSchema,
  requestIdParamSchema,
  searchRequestQuerySchema,
};
