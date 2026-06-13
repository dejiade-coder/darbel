import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MedicalController } from './medical.controller';
import { MedicalService } from './medical.service';

@Module({
  imports: [AuthModule],
  controllers: [MedicalController],
  providers: [MedicalService],
})
export class MedicalModule {}
