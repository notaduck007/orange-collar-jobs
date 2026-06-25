import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { Env } from "../config/env.schema.js";

export interface StorageUploadResult {
  readonly key: string;
  readonly bucket: string;
  readonly url: string;
}

export type StorageBucket = "resumes" | "company-logos" | "ad-assets";

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly logger = new Logger(StorageService.name);
  private readonly buckets: Record<StorageBucket, string>;

  constructor(private readonly config: ConfigService<Env>) {
    const endpoint = config.getOrThrow("STORAGE_ENDPOINT", { infer: true });
    const region = config.get("STORAGE_REGION", { infer: true }) ?? "us-east-1";
    const forcePathStyle = config.get("STORAGE_FORCE_PATH_STYLE", { infer: true }) ?? true;

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: {
        accessKeyId: config.getOrThrow("STORAGE_ACCESS_KEY", { infer: true }),
        secretAccessKey: config.getOrThrow("STORAGE_SECRET_KEY", { infer: true }),
      },
    });

    this.buckets = {
      resumes: config.get("STORAGE_BUCKET_RESUMES", { infer: true }) ?? "resumes",
      "company-logos": config.get("STORAGE_BUCKET_LOGOS", { infer: true }) ?? "company-logos",
      "ad-assets": config.get("STORAGE_BUCKET_ADS", { infer: true }) ?? "ad-assets",
    };
  }

  async upload(
    bucket: StorageBucket,
    body: Buffer | Uint8Array,
    mimeType: string,
    keyPrefix?: string,
  ): Promise<StorageUploadResult> {
    const key = `${keyPrefix ? `${keyPrefix}/` : ""}${randomUUID()}`;
    const bucketName = this.buckets[bucket];

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );

    // Use the browser-reachable public URL (falls back to the internal endpoint).
    const publicBase =
      this.config.get("STORAGE_PUBLIC_URL", { infer: true }) ??
      this.config.getOrThrow("STORAGE_ENDPOINT", { infer: true });
    const url = `${publicBase}/${bucketName}/${key}`;
    this.logger.log(`Uploaded ${key} to ${bucketName}`);
    return { key, bucket: bucketName, url };
  }

  async getSignedUrl(bucket: StorageBucket, key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.buckets[bucket], Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(bucket: StorageBucket, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.buckets[bucket], Key: key }));
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.buckets["resumes"] }));
  }
}
