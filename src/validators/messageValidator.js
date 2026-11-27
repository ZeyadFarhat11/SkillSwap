const { z } = require('zod');

const sendMessageSchema = z.object({
  receiverId: z.coerce
    .number({ invalid_type_error: 'Invalid receiver.' })
    .int('Invalid receiver.')
    .positive('Invalid receiver.'),
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(2000, 'Message cannot exceed 2000 characters.'),
});

const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive('Invalid user ID.'),
});

module.exports = { sendMessageSchema, userIdParamSchema };
