import { NestFactory } from '@nestjs/core';
import { Environments, EnvironmentSettings } from './settings/configuration/environment-settings';
import { AppModule } from './app.module';
import { applyAppInitialization } from './settings/app-initialization';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from './settings/configuration/api-settings';
import { Configuration } from './settings/configuration/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService<Configuration, true>);
  const apiSettings = configService.get<ApiSettings>('apiSettings');
  const environmentSettings = configService.get<EnvironmentSettings>('environmentSettings');

  applyAppInitialization(app);

  const PORT: number = apiSettings.PORT;
  const ENV: Environments = environmentSettings.currentEnv;

  console.log(PORT);

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
