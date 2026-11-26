const { z } = require('zod');
const { MIN_PASSWORD_LENGTH } = require('../config/constants');

const registerSchema = z
  .object({
    firstName: z.string().trim().max(75, 'First name must be 75 characters or fewer.').optional(),
    lastName: z.string().trim().max(75, 'Last name must be 75 characters or fewer.').optional(),
    name: z.string().trim().max(150, 'Name must be 150 characters or fewer.').optional(),
    email: z
      .string({ required_error: 'Please enter your email address.' })
      .trim()
      .min(1, 'Please enter your email address.')
      .email('Invalid email! Example: name@example.com')
      .max(255, 'Email must be 255 characters or fewer.')
      .toLowerCase(),
    password: z
      .string({ required_error: 'Please enter a password.' })
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      .max(128, 'Password must be 128 characters or fewer.'),
    confirmPassword: z
      .string({ required_error: 'Please confirm your password.' })
      .min(1, 'Please confirm your password.'),
  })
  .superRefine((data, ctx) => {
    const hasFullName = Boolean(data.name && data.name.length > 0);
    if (!hasFullName) {
      if (!data.firstName || data.firstName.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['firstName'],
          message: 'Please enter your first name.',
        });
      }
      if (!data.lastName || data.lastName.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lastName'],
          message: 'Please enter your last name.',
        });
      }
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  })
  .transform((data) => {
    const fullName =
      data.name && data.name.length > 0
        ? data.name
        : `${data.firstName || ''} ${data.lastName || ''}`.trim();

    return {
      name: fullName.slice(0, 150),
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email,
      password: data.password,
    };
  });

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Please enter your email address.' })
    .trim()
    .min(1, 'Please enter your email address.')
    .email('Invalid email! Example: name@example.com')
    .max(255, 'Email must be 255 characters or fewer.')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Please enter your password.' })
    .min(1, 'Please enter your password.')
    .max(128, 'Password must be 128 characters or fewer.'),
});

module.exports = {
  registerSchema,
  loginSchema,
};
