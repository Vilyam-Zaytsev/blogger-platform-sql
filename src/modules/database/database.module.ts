import { Global, Module } from '@nestjs/common';
import { DatabaseConfig } from './config/database.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfigModule } from './config/database-config.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [DatabaseConfigModule],
      inject: [DatabaseConfig],
      useFactory: (dc: DatabaseConfig) => dc.getTypeOrmConfigForPostgres(),
    }),
  ],
})
export class DatabaseModule {}
