import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { CoreConfig } from '../../core/core.config';

@Global()
@Module({
  providers: [
    {
      provide: 'PG_POOL',
      inject: [CoreConfig],
      useFactory: (coreConfig: CoreConfig) => {
        const pool = new Pool({
          host: process.env.POSTGRES_HOST,
          port: Number(process.env.POSTGRES_PORT),
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
        });

        return pool;
      },
    },
  ],
  exports: ['PG_POOL'],
})
export class DatabaseModule {}
