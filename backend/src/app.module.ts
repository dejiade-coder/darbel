import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { TradeCategoriesModule } from './modules/trade-categories/trade-categories.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MedicalModule } from './modules/medical/medical.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TenantSettingsModule } from './modules/tenant-settings/tenant-settings.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdMiddleware } from './common/interceptors/request-id.middleware';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.initialPassword',
              'req.body.code',
              'req.body.refreshToken',
              'req.body.challengeToken',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
          transport: config.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:standard' },
              },
          customProps: (req) => ({
            requestId: (req as unknown as { requestId?: string }).requestId,
          }),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        {
          name: 'default',
          ttl: 60_000,
          limit: config.get('RATE_LIMIT_DEFAULT_PER_MINUTE'),
        },
      ],
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    AuditModule,
    HealthModule,
    TradeCategoriesModule,
    RegistrationsModule,
    PaymentsModule,
    DocumentsModule,
    MedicalModule,
    CertificatesModule,
    ReportsModule,
    TenantSettingsModule,
    TenantsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
