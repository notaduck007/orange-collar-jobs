import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { envSchema } from './env.schema.js';

/** Repo-root .env only (monorepo standard — no nested src/api/.env). */
const ROOT_ENV = resolve(process.cwd(), '../../.env');

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [ROOT_ENV],
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          const missing = result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n');
          throw new Error(`Environment validation failed:\n${missing}`);
        }
        return result.data;
      },
    }),
  ],
})
export class ConfigModule {}
