import { Module } from '@nestjs/common';
import configuration, {
  Configuration,
  loadEnv,
  validate,
} from './settings/configuration/configuration';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSettings } from './settings/configuration/database-settings';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiSettings } from './settings/configuration/api-settings';
import { UserAccountsModule } from './modules/user-accounts/user-accounts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BloggersPlatformModule } from './modules/bloggers-platform/bloggers-platform.module';
import { TestingModule } from './modules/testing/testing.module';
import { QuizModule } from './modules/quiz/quiz.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: loadEnv(),
    }),
    UserAccountsModule,
    NotificationsModule,
    BloggersPlatformModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => {
        return configService
          .get<DatabaseSettings>('databaseSettings')
          .getTypeOrmConfigForPostgres();
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => {
        const { THROTTLE_TTL: ttl, THROTTLE_LIMIT: limit }: ApiSettings =
          configService.get<ApiSettings>('apiSettings');

        return [
          {
            ttl,
            limit,
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
