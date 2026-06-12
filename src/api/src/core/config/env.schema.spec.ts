import { envSchema } from './env.schema.js';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3001',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a_secret_that_is_at_least_32_characters_long',
  JWT_REFRESH_SECRET: 'another_secret_at_least_32_chars_long_ok',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_ACCESS_KEY: 'access',
  STORAGE_SECRET_KEY: 'secret',
  EMAIL_PROVIDER: 'resend',
  EMAIL_API_KEY: 're_test_key',
  EMAIL_FROM: 'test@example.com',
  API_KEY_HASH: 'some_hash',
};

describe('envSchema', () => {
  it('parses a valid env without errors', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('coerces PORT to number', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '4000' });
    expect(result.success && result.data.PORT).toBe(4000);
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects a JWT_SECRET shorter than 32 chars', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'short' });
    expect(result.success).toBe(false);
  });

  it('applies default NODE_ENV=development', () => {
    const { NODE_ENV: _, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success && result.data.NODE_ENV).toBe('development');
  });
});
