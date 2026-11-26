const { z } = require('zod');
const { TIME_REGEX, timeToMinutes } = require('../utils/time');

const createAvailabilitySchema = z
  .object({
    dayOfWeek: z.coerce
      .number({ invalid_type_error: 'Please select a valid day of the week.' })
      .int()
      .min(0, 'Day of week must be between 0 (Sunday) and 6 (Saturday).')
      .max(6, 'Day of week must be between 0 (Sunday) and 6 (Saturday).'),
    startTime: z
      .string({ required_error: 'Please enter a start time.' })
      .trim()
      .regex(TIME_REGEX, 'Start time must be in HH:mm format.'),
    endTime: z
      .string({ required_error: 'Please enter an end time.' })
      .trim()
      .regex(TIME_REGEX, 'End time must be in HH:mm format.'),
  })
  .superRefine((data, ctx) => {
    if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time must be after start time.',
      });
    }
  });

const availabilityIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid availability slot ID.'),
});

module.exports = {
  createAvailabilitySchema,
  availabilityIdParamSchema,
};
