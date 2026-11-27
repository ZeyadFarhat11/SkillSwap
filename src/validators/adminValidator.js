const { z } = require('zod');
const {
  REPORT_STATUSES,
  SESSION_STATUSES,
  SKILL_STATUSES,
  USER_STATUSES,
} = require('../config/constants');

const validReportStatuses = Object.values(REPORT_STATUSES);

const idParamSchema = z.object({
  id: z.coerce.number().int('Invalid ID.').positive('Invalid ID.'),
});

const updateReportStatusSchema = z.object({
  status: z.enum(validReportStatuses, {
    errorMap: () => ({ message: 'Invalid report status.' }),
  }),
});

const adjustPointsSchema = z.object({
  amount: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z
      .union([
        z.number().int('Adjustment amount must be a whole number.'),
        z.string().regex(/^[+-]?\d+$/, 'Adjustment amount must be a whole number.'),
      ])
      .transform((val) => Number(val))
      .refine(
        (n) => Number.isSafeInteger(n) && n !== 0,
        'Adjustment amount must be a non-zero integer.'
      )
      .refine(
        (n) => Math.abs(n) <= 100000,
        'Adjustment amount must be between -100000 and 100000.'
      )
  ),
});

const createSkillSchema = z.object({
  skillName: z
    .string({ required_error: 'Skill name is required.' })
    .trim()
    .min(2, 'Skill name must be at least 2 characters.')
    .max(120, 'Skill name must be 120 characters or fewer.'),
});

const generalSettingsSchema = z.object({
  platformName: z
    .string({ required_error: 'Platform name is required.' })
    .trim()
    .min(1, 'Platform name is required.')
    .max(80, 'Platform name must be 80 characters or fewer.'),
  platformEmail: z
    .string({ required_error: 'Platform email is required.' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid platform email address.')
    .max(255, 'Platform email must be 255 characters or fewer.'),
  platformDescription: z
    .string({ required_error: 'Platform description is required.' })
    .trim()
    .min(1, 'Platform description is required.')
    .max(500, 'Platform description must be 500 characters or fewer.'),
});

const checkboxBoolean = z
  .union([z.boolean(), z.string(), z.undefined()])
  .transform((val) => val === true || val === 'true' || val === 'on' || val === '1');

const preferencesSettingsSchema = z.object({
  allowRegistrations: checkboxBoolean,
  requireEmailVerification: checkboxBoolean,
  maintenanceMode: checkboxBoolean,
});

function buildListQuerySchema(allowedStatuses = []) {
  return z.object({
    q: z.string().trim().max(100, 'Search term must be 100 characters or fewer.').optional().default(''),
    status: z
      .enum(['', ...allowedStatuses], {
        errorMap: () => ({ message: 'Invalid filter status.' }),
      })
      .optional()
      .default(''),
  });
}

const usersQuerySchema = buildListQuerySchema(Object.values(USER_STATUSES));
const skillsQuerySchema = buildListQuerySchema(Object.values(SKILL_STATUSES));
const sessionsQuerySchema = buildListQuerySchema(Object.values(SESSION_STATUSES));
const reportsQuerySchema = buildListQuerySchema(Object.values(REPORT_STATUSES));

module.exports = {
  idParamSchema,
  updateReportStatusSchema,
  adjustPointsSchema,
  createSkillSchema,
  generalSettingsSchema,
  preferencesSettingsSchema,
  usersQuerySchema,
  skillsQuerySchema,
  sessionsQuerySchema,
  reportsQuerySchema,
};
