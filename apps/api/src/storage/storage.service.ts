import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client?: S3Client;
  private bucketName: string;
  private useLocalFallback = false;
  private localUploadsDir: string;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.get<string>('R2_BUCKET_NAME', 'comics-dev');
    this.localUploadsDir = path.resolve(process.cwd(), 'uploads');
  }

  async onModuleInit() {
    await fs.mkdir(this.localUploadsDir, { recursive: true });

    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKey = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');

    if (accountId && accessKey && secretKey && !accountId.includes('your-')) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });
      this.logger.log('✅ Cloudflare R2 storage client initialized');
    } else {
      this.useLocalFallback = true;
      this.logger.warn('⚠️ R2 credentials incomplete — using local /uploads disk storage');
    }
  }

  private sanitizeKey(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    if (
      !cleanKey ||
      cleanKey.includes('..') ||
      cleanKey.includes('\\') ||
      cleanKey.includes('\0')
    ) {
      throw new BadRequestException('Đường dẫn tệp lưu trữ không hợp lệ');
    }
    return cleanKey;
  }

  private resolveSafeLocalPath(key: string): string {
    const cleanKey = this.sanitizeKey(key);
    const fullPath = path.resolve(this.localUploadsDir, cleanKey);
    const basePrefix = this.localUploadsDir.endsWith(path.sep)
      ? this.localUploadsDir
      : this.localUploadsDir + path.sep;
    if (!fullPath.startsWith(basePrefix)) {
      throw new BadRequestException('Đường dẫn tệp lưu trữ vượt ngoài phạm vi cho phép');
    }
    return fullPath;
  }

  private getAllowedUrlOrigins(): Set<string> {
    const origins = new Set<string>();
    const candidates = [
      this.config.get<string>('R2_PUBLIC_URL', ''),
      this.config.get<string>('CDN_URL', ''),
      this.config.get<string>('API_URL', ''),
    ];
    for (const raw of candidates) {
      if (!raw) continue;
      try {
        origins.add(new URL(raw).origin);
      } catch {
        // Ignore invalid URL env values
      }
    }
    return origins;
  }

  private getPublicBaseUrl(): string {
    if (!this.useLocalFallback) {
      const r2Public = this.config.get<string>('R2_PUBLIC_URL', '').replace(/\/$/, '');
      if (r2Public) return r2Public;
    }
    const cdnUrl = this.config.get<string>('CDN_URL', '').replace(/\/$/, '');
    if (cdnUrl) return cdnUrl;
    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:4000').replace(/\/$/, '');
    return `${apiUrl}/uploads`;
  }

  async upload(key: string, body: Buffer | Readable, contentType: string): Promise<string> {
    const cleanKey = this.sanitizeKey(key);
    const buffer =
      Buffer.isBuffer(body)
        ? body
        : await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            body.on('data', (c) => chunks.push(Buffer.from(c)));
            body.on('end', () => resolve(Buffer.concat(chunks)));
            body.on('error', reject);
          });

    if (!this.useLocalFallback && this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: cleanKey,
            Body: buffer,
            ContentType: contentType,
          }),
        );
        return `${this.getPublicBaseUrl()}/${cleanKey}`;
      } catch (err: unknown) {
        this.logger.warn(`R2 upload failed for ${cleanKey}, falling back to local disk: ${(err as Error).message}`);
      }
    }

    const fullPath = this.resolveSafeLocalPath(cleanKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return `/uploads/${cleanKey}`;
  }

  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;
    if (url.startsWith('/seed/')) return; // Never delete built-in seed files
    const key = this.extractKeyFromUrl(url);
    if (key) {
      await this.delete(key);
    }
  }

  async delete(key: string): Promise<void> {
    const cleanKey = this.sanitizeKey(key);
    if (!this.useLocalFallback && this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: cleanKey,
          }),
        );
      } catch (err: unknown) {
        this.logger.warn(`R2 delete failed for ${cleanKey}: ${(err as Error).message}`);
      }
    }

    const fullPath = this.resolveSafeLocalPath(cleanKey);
    await fs.unlink(fullPath).catch(() => {});
  }

  async get(key: string): Promise<Readable | undefined> {
    const cleanKey = this.sanitizeKey(key);
    if (!this.useLocalFallback && this.s3Client) {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        }),
      );
      return response.Body as Readable | undefined;
    }

    const fullPath = this.resolveSafeLocalPath(cleanKey);
    const data = await fs.readFile(fullPath);
    return Readable.from(data);
  }

  extractKeyFromUrl(url: string): string | null {
    if (!url || url.includes('..') || url.includes('\\') || url.includes('\0')) {
      return null;
    }
    if (url.startsWith('/uploads/')) {
      const rawKey = url.slice('/uploads/'.length).split('?')[0].split('#')[0];
      return rawKey && !rawKey.includes('..') ? rawKey : null;
    }
    try {
      const parsed = new URL(url);
      const allowedOrigins = this.getAllowedUrlOrigins();
      if (!allowedOrigins.has(parsed.origin)) {
        return null;
      }
      let pathname = parsed.pathname.replace(/^\/+/, '');
      if (pathname.startsWith('uploads/')) {
        pathname = pathname.slice('uploads/'.length);
      }
      if (!pathname || pathname.includes('..')) return null;
      return pathname;
    } catch {
      return null;
    }
  }
}
