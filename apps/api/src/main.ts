import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie parser (for refresh tokens)
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('v1');

  // CORS
  const isDev = process.env.NODE_ENV !== 'production';
  const configuredOrigins = process.env.APP_URL
    ? process.env.APP_URL.split(',').map((url) => url.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: isDev
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // In dev mode, allow any origin (localhost, LAN IPs, Cloudflare tunnels, etc.)
          callback(null, true);
        }
      : configuredOrigins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 API server running on http://localhost:${port}`);
}
bootstrap();
