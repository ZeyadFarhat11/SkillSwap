const { z } = require('zod');

const submitRatingSchema = z.object({
  stars: z.coerce
    .number({ invalid_type_error: 'Please choose a star rating between 1 and 5.' })
    .int('Stars must be a whole number.')
    .min(1, 'Stars must be at least 1.')
    .max(5, 'Stars must be at most 5.'),
  comment: z.string().trim().max(1000, 'Comment must be 1000 characters or fewer.').optional(),
});

const sessionIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid session ID.'),
});

module.exports = { submitRatingSchema, sessionIdParamSchema };
