import { Global, Module } from '@nestjs/common';
import { DatabaseConfig } from './config/database.config';
import { PgPoolProvider } from './providers/pg-pool.provider';
import { PG_POOL } from './constants/database.constants';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configModule } from '../../dynamic-config.module';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    configModule,
    TypeOrmModule.forRootAsync({
      imports: [configModule],
      useFactory: (configService: ConfigService<any, true>) => {
        const databaseConfig = new DatabaseConfig(configService);
        return databaseConfig.getTypeOrmConfigForPostgres();
      },
      inject: [ConfigService],
    }),
  ],
  providers: [DatabaseConfig, PgPoolProvider],
  exports: [PG_POOL, TypeOrmModule],
})
export class DatabaseModule {}
