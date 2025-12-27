import { Module } from '@nestjs/common';

import { UserAccountsModule } from './modules/user-accounts/user-accounts.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BloggersPlatformModule } from './modules/bloggers-platform/bloggers-platform.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { EnvModule } from './env/env.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuration } from './settings/configuration/configuration';
import { DatabaseSettings } from './settings/configuration/database-settings';
import { ApiSettings } from './settings/configuration/api-settings';
import { TestingModule } from './modules/testing/testing.module';

@Module({
  imports: [
    EnvModule,
    UserAccountsModule,
    NotificationsModule,
    BloggersPlatformModule,
    TypeOrmModule.forRootAsync({
      imports: [EnvModule],
      inject: [Configuration],
      useFactory: (config: Configuration) => {
        const dbSettings: DatabaseSettings = config.databaseSettings;
        return dbSettings.getTypeOrmConfigForPostgres();
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [EnvModule],
      inject: [Configuration],
      useFactory: (config: Configuration) => {
        const apiSettings: ApiSettings = config.apiSettings;
        return [
          {
            ttl: apiSettings.THROTTLE_TTL,
            limit: apiSettings.THROTTLE_LIMIT,
          },
        ];
      },
    }),
    ...(process.env.INCLUDE_TESTING_MODULE === 'true' ? [TestingModule] : []),
    QuizModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
