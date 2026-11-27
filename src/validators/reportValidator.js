const { z } = require('zod');
const { REPORT_TYPES } = require('../config/constants');

const validTypes = Object.values(REPORT_TYPES);

const submitReportSchema = z.object({
  type: z.enum(validTypes, { errorMap: () => ({ message: 'Invalid report type.' }) }),
  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters.')
    .max(200, 'Subject cannot exceed 200 characters.'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters.')
    .max(5000, 'Description cannot exceed 5000 characters.'),
  reportedUserId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce
      .number({ invalid_type_error: 'Invalid reported user ID.' })
      .int('Invalid reported user ID.')
      .positive('Invalid reported user ID.')
      .optional()
  ),
});

module.exports = { submitReportSchema };
