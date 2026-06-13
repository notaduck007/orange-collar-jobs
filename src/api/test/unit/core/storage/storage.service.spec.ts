import type { ConfigService } from '@nestjs/config';

const send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ __type: 'Put', input })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ __type: 'Get', input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ __type: 'Delete', input })),
  HeadBucketCommand: jest.fn().mockImplementation((input: unknown) => ({ __type: 'Head', input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/object'),
}));

import { StorageService } from '@core/storage/storage.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type EnvValues = Record<string, string | boolean | undefined>;

function makeConfig(values: EnvValues): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      const v = values[key];
      if (v === undefined) throw new Error(`missing ${key}`);
      return v;
    }),
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

const env: EnvValues = {
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_REGION: 'us-east-1',
  STORAGE_ACCESS_KEY: 'access',
  STORAGE_SECRET_KEY: 'secret',
  STORAGE_FORCE_PATH_STYLE: true,
  STORAGE_BUCKET_RESUMES: 'resumes',
  STORAGE_BUCKET_LOGOS: 'company-logos',
  STORAGE_BUCKET_ADS: 'ad-assets',
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    send.mockReset();
    service = new StorageService(makeConfig(env));
  });

  describe('upload', () => {
    it('uploads to the resolved bucket and returns key/bucket/url', async () => {
      send.mockResolvedValue({});
      const result = await service.upload('resumes', Buffer.from('cv'), 'application/pdf', 'user1');

      expect(send).toHaveBeenCalledTimes(1);
      expect(result.bucket).toBe('resumes');
      expect(result.key.startsWith('user1/')).toBe(true);
      expect(result.url).toContain('http://localhost:9000/resumes/');
    });

    it('uploads without a key prefix', async () => {
      send.mockResolvedValue({});
      const result = await service.upload('company-logos', Buffer.from('img'), 'image/png');
      expect(result.bucket).toBe('company-logos');
      expect(result.key).not.toContain('/');
    });
  });

  describe('getSignedUrl', () => {
    it('returns a presigned URL', async () => {
      await expect(service.getSignedUrl('resumes', 'key123')).resolves.toBe(
        'https://signed.example/object',
      );
      expect(getSignedUrl).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('issues a delete command', async () => {
      send.mockResolvedValue({});
      await service.delete('ad-assets', 'key123');
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe('ping', () => {
    it('issues a head-bucket command against the resumes bucket', async () => {
      send.mockResolvedValue({});
      await expect(service.ping()).resolves.toBeUndefined();
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('propagates errors when storage is unreachable', async () => {
      send.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.ping()).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('configuration defaults', () => {
    it('falls back to default region/buckets when optional vars are unset', async () => {
      const minimalEnv: EnvValues = {
        STORAGE_ENDPOINT: 'http://localhost:9000',
        STORAGE_ACCESS_KEY: 'access',
        STORAGE_SECRET_KEY: 'secret',
        // STORAGE_REGION, STORAGE_FORCE_PATH_STYLE, STORAGE_BUCKET_* intentionally omitted
      };
      const svc = new StorageService(makeConfig(minimalEnv));
      send.mockResolvedValue({});
      const result = await svc.upload('resumes', Buffer.from('cv'), 'application/pdf');
      expect(result.bucket).toBe('resumes');
      await expect(svc.ping()).resolves.toBeUndefined();
    });
  });
});
