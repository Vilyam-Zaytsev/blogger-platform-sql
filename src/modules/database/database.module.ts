import { Global, Module } from '@nestjs/common';
import { DatabaseConfig } from './config/database.config';
import { PgPoolProvider } from './providers/pg-pool.provider';
import { PG_POOL } from './constants/database.constants';

@Global()
@Module({
  providers: [
    //🔸 Common:
    //config
    DatabaseConfig,
    PgPoolProvider,
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
