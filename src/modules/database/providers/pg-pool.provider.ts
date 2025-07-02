import { Provider } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseConfig } from '../config/database.config';
import { PG_POOL } from '../constants/database.constants';

export const PgPoolProvider: Provider = {
  provide: PG_POOL,
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
};
