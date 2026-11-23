import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

const MAX_MEMORY_ENTRIES = 5000;
const MEMORY_SWEEP_MS = 60_000;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private upstash?: UpstashRedis;
  private ioredis?: IORedis;
  private memoryStore = new Map<string, MemoryEntry>();
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly config: ConfigService) {}

  private get hasExternalRedis(): boolean {
    return Boolean(this.upstash || this.ioredis);
  }

  onModuleInit() {
    const upstashUrl = this.config.get<string>('UPSTASH_REDIS_REST_URL');
    const upstashToken = this.config.get<string>('UPSTASH_REDIS_REST_TOKEN');
    const redisUrl = this.config.get<string>('REDIS_URL');

    if (upstashUrl && upstashToken) {
      try {
        this.upstash = new UpstashRedis({ url: upstashUrl, token: upstashToken });
        this.logger.log('✅ Upstash Redis REST client initialized');
        return;
      } catch (err: unknown) {
        this.logger.warn(`Upstash init failed, falling back: ${(err as Error).message}`);
      }
    }

    if (redisUrl) {
      try {
        this.ioredis = new IORedis(redisUrl, {
          maxRetriesPerRequest: 2,
          lazyConnect: true,
          retryStrategy: (times) => (times > 5 ? null : Math.min(times * 250, 2000)),
        });
        this.ioredis.connect().catch((err: unknown) => {
          this.logger.warn(`Redis connection failed, using memory fallback: ${(err as Error).message}`);
        });
        this.ioredis.on('connect', () => this.logger.log('✅ IORedis connected'));
        this.ioredis.on('error', (err: unknown) => {
          this.logger.warn(`Redis error: ${(err as Error).message}`);
        });
        return;
      } catch (err: unknown) {
        this.logger.warn(`IORedis init failed: ${(err as Error).message}`);
      }
    }

    this.logger.warn('⚠️ No Redis configured — using in-memory TTL cache fallback');
    this.sweepTimer = setInterval(() => this.sweepExpiredMemory(), MEMORY_SWEEP_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
    if (this.ioredis) {
      this.ioredis.disconnect();
    }
    this.memoryStore.clear();
  }

  private sweepExpiredMemory() {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.memoryStore.delete(key);
      }
    }
  }

  private getMemory(key: string): string | null {
    const entry = this.memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return entry.value;
  }

  private setMemory(key: string, serialized: string, ttlSeconds?: number, preserveExpiry = false) {
    const existing = this.memoryStore.get(key);
    const now = Date.now();
    let expiresAt: number | null = ttlSeconds ? now + ttlSeconds * 1000 : null;
    if (preserveExpiry && existing && (existing.expiresAt === null || existing.expiresAt > now)) {
      expiresAt = existing.expiresAt;
    }

    if (!this.memoryStore.has(key) && this.memoryStore.size >= MAX_MEMORY_ENTRIES) {
      this.sweepExpiredMemory();
      if (this.memoryStore.size >= MAX_MEMORY_ENTRIES) {
        const oldestKey = this.memoryStore.keys().next().value;
        if (oldestKey !== undefined) {
          this.memoryStore.delete(oldestKey);
        }
      }
    }
    this.memoryStore.set(key, { value: serialized, expiresAt });
  }

  private parseValue<T>(raw: unknown): T | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'string') return raw as T;
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    return raw as unknown as T;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      if (this.upstash) {
        const val = await this.upstash.get<unknown>(key);
        return this.parseValue<T>(val);
      }
      if (this.ioredis && this.ioredis.status === 'ready') {
        const val = await this.ioredis.get(key);
        return this.parseValue<T>(val);
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis GET(${key}) fallback: ${(err as Error).message}`);
    }
    return this.parseValue<T>(this.getMemory(key));
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

    try {
      if (this.upstash) {
        if (ttlSeconds) {
          await this.upstash.set(key, payload, { ex: ttlSeconds });
        } else {
          await this.upstash.set(key, payload);
        }
        return;
      }
      if (this.ioredis && this.ioredis.status === 'ready') {
        if (ttlSeconds) {
          await this.ioredis.set(key, payload, 'EX', ttlSeconds);
        } else {
          await this.ioredis.set(key, payload);
        }
        return;
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis SET(${key}) error: ${(err as Error).message}`);
    }

    if (!this.hasExternalRedis) {
      this.setMemory(key, payload, ttlSeconds);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    for (const k of keys) this.memoryStore.delete(k);

    try {
      if (this.upstash) {
        await this.upstash.del(...keys);
        return;
      }
      if (this.ioredis && this.ioredis.status === 'ready') {
        await this.ioredis.del(...keys);
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis DEL error: ${(err as Error).message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.upstash) {
        return (await this.upstash.exists(key)) === 1;
      }
      if (this.ioredis && this.ioredis.status === 'ready') {
        return (await this.ioredis.exists(key)) === 1;
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis EXISTS(${key}) error: ${(err as Error).message}`);
    }
    return this.getMemory(key) !== null;
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    try {
      if (this.upstash) {
        const val = await this.upstash.incr(key);
        if (ttlSeconds && val === 1) await this.upstash.expire(key, ttlSeconds);
        return val;
      }
      if (this.ioredis && this.ioredis.status === 'ready') {
        const val = await this.ioredis.incr(key);
        if (ttlSeconds && val === 1) await this.ioredis.expire(key, ttlSeconds);
        return val;
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis INCR(${key}) error: ${(err as Error).message}`);
    }
    const prevRaw = this.getMemory(key);
    const prev = Number(prevRaw || 0);
    const next = prev + 1;
    this.setMemory(key, String(next), ttlSeconds, prevRaw !== null);
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.hasExternalRedis) {
      const existing = this.getMemory(key);
      if (existing !== null) this.setMemory(key, existing, seconds);
    }

    try {
      if (this.upstash) {
        await this.upstash.expire(key, seconds);
        return;
      }
      if (this.ioredis && this.ioredis.status === 'ready') {
        await this.ioredis.expire(key, seconds);
      }
    } catch {
      // Ignore
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
    const regex = new RegExp(regexStr);
    for (const key of Array.from(this.memoryStore.keys())) {
      if (regex.test(key)) this.memoryStore.delete(key);
    }

    try {
      if (this.upstash) {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.upstash.scan(cursor, { match: pattern, count: 100 });
          if (keys.length > 0) {
            await this.upstash.del(...keys);
          }
          cursor = String(nextCursor);
        } while (cursor !== '0');
        return;
      }
      if (this.ioredis && this.ioredis.status === 'ready') {
        const stream = this.ioredis.scanStream({ match: pattern, count: 200 });
        const pendingDeletes: Array<Promise<unknown>> = [];
        await new Promise<void>((resolve) => {
          stream.on('data', (batch: string[]) => {
            if (batch.length > 0 && this.ioredis) {
              pendingDeletes.push(this.ioredis.del(...batch).catch(() => {}));
            }
          });
          stream.on('end', () => resolve());
          stream.on('error', () => resolve());
        });
        await Promise.allSettled(pendingDeletes);
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis deletePattern(${pattern}) error: ${(err as Error).message}`);
    }
  }
}
