import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';

// Monorepo standard: single root .env (see docs/agent/standards/common/monorepo.md).
// `override: false` keeps CI-provided env vars authoritative.
config({ path: resolve(__dirname, '../../../.env'), override: false });
