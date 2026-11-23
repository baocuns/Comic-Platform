import { ConfigService } from '@nestjs/config';

export function resolveJwtSecret(
  config: ConfigService,
  envKey: 'JWT_SECRET' | 'JWT_REFRESH_SECRET',
  devFallback: string,
): string {
  const raw = config.get<string>(envKey)?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!raw || raw.length < 32) {
      throw new Error(
        `${envKey} must be configured with at least 32 characters in production`,
      );
    }
    return raw;
  }
  return raw && raw.length > 0 ? raw : devFallback;
}
