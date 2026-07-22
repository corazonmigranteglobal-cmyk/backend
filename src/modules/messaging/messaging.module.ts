import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MessageOutbox, MessageSendLog } from '@/database/models';
import { MessagingController } from './messaging.controller';
import { MessagingProviderService } from './messaging-provider.service';
import { MessagingService } from './messaging.service';

@Module({
  imports: [SequelizeModule.forFeature([MessageOutbox, MessageSendLog])],
  providers: [MessagingProviderService, MessagingService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
