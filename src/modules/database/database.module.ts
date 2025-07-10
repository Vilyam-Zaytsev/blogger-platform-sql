import { Global, Module } from '@nestjs/common';
import { DatabaseConfig } from './config/database.config';
import { PgPoolProvider } from './providers/pg-pool.provider';
import { PG_POOL } from './constants/database.constants';
import { MigrationRunnerService } from './migration-runner.service';

@Global()
@Module({
  providers: [DatabaseConfig, PgPoolProvider, MigrationRunnerService],
  exports: [PG_POOL],
})
export class DatabaseModule {}
