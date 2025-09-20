import { DynamicModule, INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { appSetup } from '../../src/setup/app.setup';
import { Server } from 'http';
import { CoreConfig } from '../../src/core/core.config';
import { initAppModule } from '../../src/init-app-module';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AdminCredentials, MemoryThrottlerStorageLike } from '../types';
import { DataSource } from 'typeorm';

export class AppTestManager {
  app: INestApplication;
  dataSource: DataSource;
  coreConfig: CoreConfig;

  async init(addSettingsToModuleBuilder?: (moduleBuilder: TestingModuleBuilder) => void) {
    const DynamicAppModule: DynamicModule = await initAppModule();

    const testingModuleBuilder: TestingModuleBuilder = Test.createTestingModule({
      imports: [DynamicAppModule],
    });

    if (addSettingsToModuleBuilder) {
      addSettingsToModuleBuilder(testingModuleBuilder);
    }

    const testingAppModule = await testingModuleBuilder.compile();

    this.app = testingAppModule.createNestApplication();

    this.coreConfig = this.app.get<CoreConfig>(CoreConfig);
    this.dataSource = this.app.get<DataSource>(DataSource);

    appSetup(this.app, this.coreConfig.isSwaggerEnabled);

    await this.app.init();
  }

  async cleanupDb(excludedTables: string[]) {
    const tables: Array<{ table_name: string }> = await this.dataSource.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
    );

    await Promise.all(
      tables
        .map((row: { table_name: string }) => row.table_name)
        .filter((tableName) => !excludedTables.includes(tableName))
        .map(async (tableName) => {
          await this.dataSource.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
        }),
    );
  }

  clearThrottlerStorage() {
    const throttlerStorage: ThrottlerStorage = this.app.get<ThrottlerStorage>(ThrottlerStorage);

    const memoryStorage = throttlerStorage as MemoryThrottlerStorageLike;

    if (memoryStorage.storage instanceof Map) {
      memoryStorage.storage.clear();
    }
  }

  async close() {
    await this.dataSource.destroy();
    await this.app.close();
  }

  getServer() {
    return this.app.getHttpServer() as Server;
  }

  getAdminCredentials(): AdminCredentials {
    const login: string | undefined = this.coreConfig.adminLogin;
    const password: string | undefined = this.coreConfig.adminPassword;

    if (!login || !password) {
      throw new Error(
        'Admin credentials are not configured properly: ' +
          'ADMIN_LOGIN and/or ADMIN_PASSWORD environment variables are missing or empty.',
      );
    }

    return {
      login,
      password,
    };
  }
}
