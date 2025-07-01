import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseConfig } from './config/database.config';

@Global()
@Module({
  providers: [
    {
      provide: 'PG_POOL',
      inject: [DatabaseConfig],
      useFactory: (databaseConfig: DatabaseConfig) => {
        return new Pool({
          host: databaseConfig.postgresHost,
          port: databaseConfig.postgresPort,
          user: databaseConfig.postgresUser,
          password: databaseConfig.postgresPassword,
          database: databaseConfig.postgresDbName,
        });
      },
    },

    //🔸 Common:
    //config
    DatabaseConfig,
  ],
  exports: ['PG_POOL'],
})
export class DatabaseModule {}
