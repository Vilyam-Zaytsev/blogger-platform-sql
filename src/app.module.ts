import { DynamicModule, Module } from '@nestjs/common';
import { CoreConfig } from './core/core.config';
import { configModule } from './dynamic-config.module';
import { CoreModule } from './core/core.module';
import { TestingModule } from './modules/testing/testing.module';
import { DatabaseModule } from './modules/database/database.module';
import { UserAccountsModule } from './modules/user-accounts/user-accounts.module';

@Module({
  imports: [configModule, CoreModule, DatabaseModule, UserAccountsModule],
  controllers: [],
  providers: [],
})
export class AppModule {
  static forRoot(coreConfig: CoreConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [...(coreConfig.includeTestingModule ? [TestingModule] : [])],
    };
  }
}
