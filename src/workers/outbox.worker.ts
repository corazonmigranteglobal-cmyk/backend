import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { MessagingService } from '@/modules/messaging/messaging.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const messaging = app.get(MessagingService);
    const result = await messaging.processPending(100);
    // eslint-disable-next-line no-console
    console.log(result);
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('outbox.worker failed:', error);
  process.exitCode = 1;
});
