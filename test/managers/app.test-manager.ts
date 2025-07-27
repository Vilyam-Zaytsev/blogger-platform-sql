import { DynamicModule, INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { appSetup } from '../../src/setup/app.setup';
import { Server } from 'http';
import { CoreConfig } from '../../src/core/core.config';
import { initAppModule } from '../../src/init-app-module';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Pool } from 'pg';
import { PG_POOL } from '../../src/modules/database/constants/database.constants';
import { AdminCredentials, MemoryThrottlerStorageLike } from '../types';

export class AppTestManager {
  app: INestApplication;
  pool: Pool;
  coreConfig: CoreConfig;

  async init(
    addSettingsToModuleBuilder?: (moduleBuilder: TestingModuleBuilder) => void,
  ) {
    const DynamicAppModule: DynamicModule = await initAppModule();

    const testingModuleBuilder: TestingModuleBuilder = Test.createTestingModule(
      {
        imports: [DynamicAppModule],
      },
    );

    if (addSettingsToModuleBuilder) {
      addSettingsToModuleBuilder(testingModuleBuilder);
    }

    const testingAppModule = await testingModuleBuilder.compile();

    this.app = testingAppModule.createNestApplication();

    this.coreConfig = this.app.get<CoreConfig>(CoreConfig);
    this.pool = this.app.get<Pool>(PG_POOL);

    appSetup(this.app, this.coreConfig.isSwaggerEnabled);

    await this.app.init();
  }

  async cleanupDb(excludedTables: string[]) {
    const tables = await this.pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
    );

    await Promise.all(
      tables.rows
        .map((row) => row.table_name)
        .filter((tableName) => !excludedTables.includes(tableName))
        .map(async (tableName) => {
          await this.pool.query(
            `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`,
          );
        }),
    );
  }

  clearThrottlerStorage() {
    const throttlerStorage: ThrottlerStorage =
      this.app.get<ThrottlerStorage>(ThrottlerStorage);

    const memoryStorage = throttlerStorage as MemoryThrottlerStorageLike;

    if (memoryStorage.storage instanceof Map) {
      memoryStorage.storage.clear();
    }
  }

  async close() {
    await this.pool.end();
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
