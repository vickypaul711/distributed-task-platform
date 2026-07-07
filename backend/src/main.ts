import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { withTimestamp } from './common/logging/log-payload';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(port);

  logger.log(
    withTimestamp({
      event: 'APPLICATION_STARTED',
      port,
    }),
  );
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');

  logger.error(
    withTimestamp({
      event: 'APPLICATION_START_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
    error instanceof Error ? error.stack : undefined,
  );

  process.exit(1);
});
