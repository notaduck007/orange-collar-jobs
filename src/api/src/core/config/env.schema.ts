import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z
    .string()
    .refine((s) => s.startsWith('postgresql://') || s.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string',
    }),
  TEST_DATABASE_URL: z
    .string()
    .refine((s) => s.startsWith('postgresql://') || s.startsWith('postgres://'), {
      message: 'TEST_DATABASE_URL must be a PostgreSQL connection string',
    })
    .optional(),

  REDIS_URL: z.string().refine((s) => s.startsWith('redis://') || s.startsWith('rediss://'), {
    message: 'REDIS_URL must be a Redis connection string',
  }),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  STORAGE_ENDPOINT: z.string().refine((s) => s.startsWith('http://') || s.startsWith('https://'), {
    message: 'STORAGE_ENDPOINT must be an HTTP(S) URL',
  }),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET_RESUMES: z.string().default('resumes'),
  STORAGE_BUCKET_LOGOS: z.string().default('company-logos'),
  STORAGE_BUCKET_ADS: z.string().default('ad-assets'),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid']).default('resend'),
  EMAIL_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().default('WarehouseJobs'),

  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().startsWith('VA').optional(),

  API_KEY_HASH: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;
