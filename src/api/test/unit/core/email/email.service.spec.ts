import type { ConfigService } from '@nestjs/config';
import { EmailService } from '@core/email/email.service';

type EnvValues = Record<string, string | undefined>;

function makeConfig(values: EnvValues): ConfigService {
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

const devConfig = makeConfig({ NODE_ENV: 'development' });
const prodConfig = makeConfig({
  NODE_ENV: 'production',
  EMAIL_API_KEY: 'resend-key',
  EMAIL_FROM: 'noreply@warehousejobs.com',
  EMAIL_FROM_NAME: 'WarehouseJobs',
});

describe('EmailService', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('development mode — no external calls', () => {
    let svc: EmailService;

    beforeEach(() => {
      svc = new EmailService(devConfig);
    });

    it('resolves without throwing when sending an email', async () => {
      await expect(
        svc.send({ to: 'user@test.com', subject: 'Hello', html: '<p>Hello</p>' }),
      ).resolves.toBeUndefined();
    });

    it('does NOT call fetch in dev mode', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      await svc.send({ to: 'user@test.com', subject: 'Hello', html: '<p>Hello</p>' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sendVerificationEmail resolves and does not call fetch', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      await expect(
        svc.sendVerificationEmail('user@test.com', 'tok123', 'http://localhost:3000'),
      ).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sendPasswordResetEmail resolves and does not call fetch', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      await expect(
        svc.sendPasswordResetEmail('user@test.com', 'tok456', 'http://localhost:3000'),
      ).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('production mode — calls Resend API', () => {
    let svc: EmailService;

    beforeEach(() => {
      svc = new EmailService(prodConfig);
    });

    it('resolves on a 200 response from Resend', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{"id":"abc"}', { status: 200 }),
      );
      await expect(
        svc.send({ to: 'user@test.com', subject: 'Test', html: '<p>Test</p>' }),
      ).resolves.toBeUndefined();
    });

    it('calls Resend with the correct Authorization header', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{}', { status: 200 }),
      );
      await svc.send({ to: 'user@test.com', subject: 'Test', html: '<p>Test</p>' });
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer resend-key');
    });

    it('throws when Resend returns a non-2xx status', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Bad request', { status: 400 }),
      );
      await expect(
        svc.send({ to: 'user@test.com', subject: 'Test', html: '<p>Test</p>' }),
      ).rejects.toThrow('Email delivery failed (400)');
    });

    it('sendVerificationEmail calls Resend with a verify link', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{}', { status: 200 }),
      );
      await svc.sendVerificationEmail('u@test.com', 'abc123', 'https://app.example.com');
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
      expect((body.html as string)).toContain('/verify-email?token=abc123');
    });

    it('sendPasswordResetEmail calls Resend with a reset link', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{}', { status: 200 }),
      );
      await svc.sendPasswordResetEmail('u@test.com', 'xyz789', 'https://app.example.com');
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
      expect((body.html as string)).toContain('/reset-password?token=xyz789');
    });
  });

  describe('defaults when env vars are absent', () => {
    it('uses fallback from/name when EMAIL_FROM and EMAIL_FROM_NAME are unset', async () => {
      const svc = new EmailService(makeConfig({ NODE_ENV: 'production', EMAIL_API_KEY: 'k' }));
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{}', { status: 200 }),
      );
      await svc.send({ to: 'u@test.com', subject: 'S', html: '<p/>' });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.from).toBe('WarehouseJobs <noreply@warehousejobs.com>');
    });
  });

  it('unused logSpy ref to suppress lint', () => {
    expect(logSpy).toBeDefined();
  });
});
