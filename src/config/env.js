const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: isTest
    ? z.string().min(1).default('mysql://skillswap:skillswap@localhost:3306/skillswap')
    : z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: isTest
    ? z.string().min(1).default('test-session-secret')
    : z.string().min(12, 'SESSION_SECRET must be at least 12 characters'),
  ML_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  STARTER_POINTS: z.coerce.number().int().nonnegative().default(20),
  POINTS_PER_SESSION: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL:
    process.env.DATABASE_URL ||
    (process.env.NODE_ENV !== 'production'
      ? 'mysql://skillswap:skillswap@localhost:3306/skillswap'
      : undefined),
  SESSION_SECRET:
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'dev-only-session-secret-change-me' : undefined),
  ML_SERVICE_URL: process.env.ML_SERVICE_URL,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  MAX_UPLOAD_MB: process.env.MAX_UPLOAD_MB,
  STARTER_POINTS: process.env.STARTER_POINTS,
  POINTS_PER_SESSION: process.env.POINTS_PER_SESSION,
});

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

module.exports = parsed.data;
