import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      url: this.config.get<string>('UPSTASH_REDIS_REST_URL', ''),
      token: this.config.get<string>('UPSTASH_REDIS_REST_TOKEN', ''),
    });
    this.logger.log('✅ Upstash Redis client initialized');
  }

  /**
   * Get a cached value by key.
   */
  async get<T = string>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  /**
   * Set a cached value with optional TTL (in seconds).
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<void> {
    await this.client.del(...keys);
  }

  /**
   * Check if a key exists.
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Increment a counter (e.g., view counts).
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Set expiration on a key.
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  /**
   * Delete all keys matching a pattern (use sparingly).
   */
  async deletePattern(pattern: string): Promise<void> {
    let cursor = 0;
    do {
      const result = await this.client.scan(cursor, {
        match: pattern,
        count: 100,
      });
      cursor = Number(result[0]);
      const keys = result[1] as string[];
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== 0);
  }
}
