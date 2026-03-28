import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client!: S3Client;
  private bucketName: string;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.get<string>('R2_BUCKET_NAME', 'comics-dev');
  }

  onModuleInit() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY', ''),
      },
    });
    this.logger.log('✅ Cloudflare R2 storage client initialized');
  }

  /**
   * Upload a file to R2 storage.
   * @param key - The storage path (e.g., "covers/comic-id/cover.webp")
   * @param body - File buffer or stream
   * @param contentType - MIME type (e.g., "image/webp")
   * @returns The public URL of the uploaded file
   */
  async upload(key: string, body: Buffer | Readable, contentType: string): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const publicUrl = this.config.get<string>('R2_PUBLIC_URL', '');
    return `${publicUrl}/${key}`;
  }

  /**
   * Delete a file from R2 storage.
   */
  async delete(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  }

  /**
   * Get a file from R2 storage.
   */
  async get(key: string): Promise<Readable | undefined> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
    return response.Body as Readable | undefined;
  }

  /**
   * Get the public URL for a stored file.
   */
  getPublicUrl(key: string): string {
    const publicUrl = this.config.get<string>('R2_PUBLIC_URL', '');
    return `${publicUrl}/${key}`;
  }
}
