import { NestFactory } from '@nestjs/core';
import { Configuration, validate } from './settings/configuration/configuration';
import { ApiSettings } from './settings/configuration/api-settings';
import { Environments, EnvironmentSettings } from './settings/configuration/environment-settings';
import { AppModule } from './app.module';
import { applyAppInitialization } from './settings/app-initialization';

async function bootstrap() {
  const config: Configuration = validate(process.env as Record<string, string>);
  const apiSettings: ApiSettings = config.apiSettings;
  const environmentSettings: EnvironmentSettings = config.environmentSettings;

  const app = await NestFactory.create(AppModule);

  applyAppInitialization(app);

  const PORT: number = apiSettings.PORT;
  const ENV: Environments = environmentSettings.currentEnv;

  await app.listen(PORT, () => {
    console.log(`\n✅ Application is running in ${ENV} mode`);
    console.log(`📡 Server listening on port ${PORT}`);
    console.log(`🌍 Environment: ${ENV}\n`);
  });
}

bootstrap().catch((error) => {
  console.error('❌ Failed to bootstrap application:', error);
  process.exit(1);
});
