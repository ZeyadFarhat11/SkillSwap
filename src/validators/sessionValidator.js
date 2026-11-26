const { z } = require('zod');

const NAIVE_DATETIME_LOCAL_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

const createSessionSchema = z.object({
  swapRequestId: z.coerce.number().int().positive('Invalid swap request ID.'),
  dateTime: z.preprocess((val) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (NAIVE_DATETIME_LOCAL_REGEX.test(trimmed)) {
        return `${trimmed}Z`;
      }
      return trimmed;
    }
    return val;
  }, z.coerce.date({ required_error: 'Session date and time is required.', invalid_type_error: 'Please enter a valid date and time.' })),
});

const sessionIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid session ID.'),
});

module.exports = {
  createSessionSchema,
  sessionIdParamSchema,
};
