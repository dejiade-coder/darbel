import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TenantSettingsController],
  providers: [TenantSettingsService],
})
export class TenantSettingsModule {}
