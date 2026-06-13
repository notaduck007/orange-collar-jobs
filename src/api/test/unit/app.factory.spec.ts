/**
 * Unit tests for configureApp() (app.factory.ts)
 *
 * configureApp() is the single source of truth for NestJS pipeline configuration
 * shared by main.ts and the test harness. These tests verify that every critical
 * setting is applied so that drift between test and production is impossible.
 */
import type { INestApplication } from '@nestjs/common';
import { configureApp } from '../../src/app.factory.js';

interface MockApp {
  _pipes: unknown[];
  _filters: unknown[];
  _prefix: string;
  _versioningOptions: Record<string, unknown> | undefined;
  useGlobalPipes: jest.Mock;
  useGlobalFilters: jest.Mock;
  setGlobalPrefix: jest.Mock;
  enableVersioning: jest.Mock;
}

function buildMockApp(): MockApp {
  const mock: MockApp = {
    _pipes: [],
    _filters: [],
    _prefix: '',
    _versioningOptions: undefined,
    useGlobalPipes: jest.fn((...args: unknown[]) => { mock._pipes.push(...args); }),
    useGlobalFilters: jest.fn((...args: unknown[]) => { mock._filters.push(...args); }),
    setGlobalPrefix: jest.fn((prefix: string) => { mock._prefix = prefix; }),
    enableVersioning: jest.fn((opts: Record<string, unknown>) => { mock._versioningOptions = opts; }),
  };
  return mock;
}

describe('configureApp()', () => {
  it('sets global prefix to "api"', () => {
    const app = buildMockApp();
    configureApp(app as unknown as INestApplication);
    expect(app._prefix).toBe('api');
  });

  it('enables URI versioning with defaultVersion "1"', () => {
    const app = buildMockApp();
    configureApp(app as unknown as INestApplication);
    expect(app._versioningOptions).toMatchObject({ defaultVersion: '1' });
  });

  it('registers a global pipe (ValidationPipe)', () => {
    const app = buildMockApp();
    configureApp(app as unknown as INestApplication);
    expect(app._pipes.length).toBeGreaterThanOrEqual(1);
  });

  it('registers a global filter (GlobalExceptionFilter)', () => {
    const app = buildMockApp();
    configureApp(app as unknown as INestApplication);
    expect(app._filters.length).toBeGreaterThanOrEqual(1);
  });

  it('calls each setup method exactly once', () => {
    const app = buildMockApp();
    configureApp(app as unknown as INestApplication);
    expect(app.setGlobalPrefix).toHaveBeenCalledTimes(1);
    expect(app.enableVersioning).toHaveBeenCalledTimes(1);
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.useGlobalFilters).toHaveBeenCalledTimes(1);
  });
});
