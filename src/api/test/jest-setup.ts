import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { applyTestEnvToProcess } from './helpers/test-env';

// Monorepo standard: single root .env (see docs/agent/standards/common/monorepo.md).
// `override: false` keeps CI-provided env vars authoritative.
config({ path: resolve(__dirname, '../../../.env'), override: false });

// CI has no .env — supply schema-complete defaults so ConfigModule unit tests compile.
applyTestEnvToProcess();
