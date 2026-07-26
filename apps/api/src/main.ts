import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApplication, safeStartupMessage } from './bootstrap';
import { RuntimeConfigService } from './config/runtime-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  configureApplication(app);
  await app.listen(app.get(RuntimeConfigService).port, '127.0.0.1');
}

void bootstrap().catch((error: unknown) => {
  console.error(`API startup failed: ${safeStartupMessage(error)}`);
  process.exitCode = 1;
});
