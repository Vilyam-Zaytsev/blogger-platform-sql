import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { Server } from 'http';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AdminCredentials, MemoryThrottlerStorageLike } from '../types';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Configuration } from '../../src/settings/configuration/configuration';
import { EnvModule } from '../../src/env/env.module';
import { applyAppInitialization } from '../../src/settings/app-initialization';
import { BusinessRulesSettings } from '../../src/settings/configuration/business-rules-settings';

export class AppTestManager {
  app: INestApplication;
  dataSource: DataSource;
  config: Configuration;

  async init(addSettingsToModuleBuilder?: (moduleBuilder: TestingModuleBuilder) => void) {
    const testingModuleBuilder: TestingModuleBuilder = Test.createTestingModule({
      imports: [AppModule, EnvModule],
    });

    if (addSettingsToModuleBuilder) {
      addSettingsToModuleBuilder(testingModuleBuilder);
    }

    const testingAppModule = await testingModuleBuilder.compile();

    this.app = testingAppModule.createNestApplication();

    this.config = testingAppModule.get(Configuration);
    this.dataSource = this.app.get<DataSource>(DataSource);

    applyAppInitialization(this.app);

    await this.app.init();
  }

  async cleanupDb(excludedTables: string[] = ['migrations']): Promise<void> {
    const tables: { table_name: string }[] = await this.dataSource.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
    `);

    for (const { table_name } of tables) {
      if (excludedTables.includes(table_name)) {
        continue;
      }

      await this.dataSource.query(`
        TRUNCATE TABLE "public"."${table_name}"
        RESTART IDENTITY
        CASCADE;
      `);
    }
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
    const businessRulesSettings: BusinessRulesSettings = this.config.businessRulesSettings;
    const login: string | undefined = businessRulesSettings.ADMIN_LOGIN;
    const password: string | undefined = businessRulesSettings.ADMIN_PASSWORD;

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
