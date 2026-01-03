import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration, EnvironmentVariable } from '../settings/configuration/configuration';

/**
 * Модуль для управления конфигурацией приложения
 *
 * Регистрирует Configuration в DI контейнере NestJS
 * Все остальные модули могут инжектировать Configuration через:
 *
 * constructor(private readonly config: Configuration) {}
 *
 * Затем получать Settings:
 * const apiSettings = this.config.apiSettings;
 * const dbSettings = this.config.databaseSettings;
 */
@Module({
  imports: [
    /**
     * ConfigModule - встроенный модуль NestJS для управления переменными окружения
     *
     * isGlobal: true - делает ConfigModule доступным во всех модулях
     * envFilePath: [] - отключаем встроенную загрузку .env (мы используем свою)
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [], // Мы используем свой loadEnv() в configuration.ts
    }),
  ],
  providers: [
    /**
     * Провайдер для Configuration
     *
     * useValue: new Configuration(...) - просто создаём экземпляр
     * Вариант с useFactory был бы более сложным и не нужен в данном случае
     */
    {
      provide: Configuration,
      useValue: Configuration.createConfig(process.env as EnvironmentVariable),
    },
  ],
  exports: [Configuration], // Экспортируем, чтобы другие модули могли использовать
})
export class EnvModule {}
