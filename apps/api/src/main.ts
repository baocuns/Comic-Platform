import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  // Security headers (before static assets so /uploads/ receives nosniff & protections)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Ensure local fallback upload directory exists and serve statically at /uploads
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Cookie parser for refresh tokens
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('v1');

  // CORS with credentials
  const isDev = process.env.NODE_ENV === 'development';
  const configuredOrigins = process.env.APP_URL
    ? process.env.APP_URL.split(',').map((url) => url.trim()).filter(Boolean)
    : ['http://localhost:3000'];

  app.enableCors({
    origin: isDev
      ? (_origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
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

  // Global filters & response envelope
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // Swagger documentation (non-production or explicitly enabled)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('OWOC 2.0 Comic Platform API')
      .setDescription('REST & WebSocket API for OWOC Online Comic & Cultivation Platform')
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 OWOC 2.0 API running on http://localhost:${port}/v1 (Docs: /api/docs)`);
}

bootstrap();
