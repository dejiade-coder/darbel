import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const config = app.get(AppConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: false,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Trust the proxy so req.ip reflects the real client when behind a load
  // balancer or reverse proxy (e.g. Nginx, MainOne edge).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`Darbel backend listening on :${port} (${config.get('NODE_ENV')})`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
