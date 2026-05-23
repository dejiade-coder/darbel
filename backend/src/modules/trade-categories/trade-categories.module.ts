import { Module } from '@nestjs/common';
import { TradeCategoriesController } from './trade-categories.controller';
import { TradeCategoriesService } from './trade-categories.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TradeCategoriesController],
  providers: [TradeCategoriesService],
  exports: [TradeCategoriesService],
})
export class TradeCategoriesModule {}
