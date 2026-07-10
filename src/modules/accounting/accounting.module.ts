import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Account,
  AccountGroup,
  AccountingEntry,
  AccountingTransaction,
  Appointment,
  CostCenter,
} from '@/database/models';
import { AuditModule } from '../audit/audit.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
@Module({
  imports: [
    SequelizeModule.forFeature([
      AccountGroup,
      Account,
      CostCenter,
      AccountingTransaction,
      AccountingEntry,
      Appointment,
    ]),
    AuditModule,
  ],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
