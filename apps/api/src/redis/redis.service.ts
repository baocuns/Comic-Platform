import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('⚠️ REDIS_URL not configured. Redis caching will be disabled.');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy(times) {
          return Math.min(times * 200, 3000);
        },
      });

      this.client.connect().catch((err: any) => {
        this.logger.error(`❌ Redis connection error: ${err.message}`);
      });

      this.client.on('connect', () => {
        this.logger.log('✅ Redis connected successfully');
      });

      this.client.on('error', (err: any) => {
        this.logger.error(`❌ Redis error: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.error(`❌ Failed to initialize Redis client: ${err.message}`);
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  /**
   * Get a cached value by key.
   */
  async get<T = string>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const val = await this.client.get(key);
    if (val === null) return null;
    if (
      (val.startsWith('{') && val.endsWith('}')) ||
      (val.startsWith('[') && val.endsWith(']'))
    ) {
      try {
        return JSON.parse(val) as T;
      } catch {
        return val as unknown as T;
      }
    }
    return val as unknown as T;
  }

  /**
   * Set a cached value with optional TTL (in seconds).
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    const payload =
      typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
    if (ttlSeconds) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    await this.client.del(...keys);
  }

  /**
   * Check if a key exists.
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Increment a counter (e.g., view counts).
   */
  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.incr(key);
  }

  /**
   * Set expiration on a key.
   */
  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.expire(key, seconds);
  }

  /**
   * Delete all keys matching a pattern.
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.client) return;
    const stream = this.client.scanStream({
      match: pattern,
      count: 100,
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          stream.pause();
          try {
            await this.client!.del(...keys);
          } catch {
            // continue
          } finally {
            stream.resume();
          }
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });
  }
}
