import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Appointment,
  FileAsset,
  TherapistBlockedTime,
  TherapistProduct,
  TherapistProfile,
  TherapistSchedule,
  TherapyProduct,
  User,
} from '@/database/models';
import { AuditModule } from '../audit/audit.module';
import {
  AdminSchedulingController,
  BookingController,
  SchedulingController,
} from './scheduling.controller';
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      TherapistSchedule,
      TherapistBlockedTime,
      Appointment,
      TherapyProduct,
      TherapistProfile,
      TherapistProduct,
      User,
      FileAsset,
    ]),
    AuditModule,
  ],
  controllers: [SchedulingController, AdminSchedulingController, BookingController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
