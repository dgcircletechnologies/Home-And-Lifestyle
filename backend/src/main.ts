import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readEnvironment } from './environment';

async function bootstrap() {
  let port: number;
  try {
    ({ port } = readEnvironment());
  } catch (error) {
    // Configuration errors contain only fixed messages, never input values.
    console.error(error instanceof Error ? error.message : 'Invalid API configuration.');
    process.exitCode = 1;
    return;
  }
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}
void bootstrap().catch(() => {
  console.error('API startup failed. Check configuration and port availability.');
  process.exitCode = 1;
});
