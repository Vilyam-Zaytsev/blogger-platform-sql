import { Injectable } from '@nestjs/common';
import { IsNotEmpty, IsNumber } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { configValidator } from '../../../core/utils/config.validator';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig {
  @IsNotEmpty({
    message: 'Set Env variable POSTGRES_HOST, example: localhost',
  })
  postgresHost: string;

  @IsNumber({}, { message: 'Set Env variable POSTGRES_PORT, example: 5432' })
  postgresPort: number;

  @IsNotEmpty({
    message: 'Set Env variable POSTGRES_USER, example: postgres',
  })
  postgresUser: string;

  @IsNotEmpty({
    message: 'Set Env variable POSTGRES_PASSWORD, example: your_password',
  })
  postgresPassword: string;

  @IsNotEmpty({
    message: 'Set Env variable POSTGRES_DB_NAME, example: your_db',
  })
  postgresDbName: string;

  constructor(private configService: ConfigService<any, true>) {
    this.postgresHost = this.configService.get('POSTGRES_HOST');

    this.postgresPort = Number(this.configService.get('POSTGRES_PORT'));

    this.postgresUser = this.configService.get('POSTGRES_USER');

    this.postgresPassword = this.configService.get('POSTGRES_PASSWORD');

    this.postgresDbName = this.configService.get('POSTGRES_DB_NAME');

    configValidator.validateConfig(this);
  }

  getTypeOrmConfigForPostgres(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.postgresHost,
      port: this.postgresPort,
      username: this.postgresUser,
      password: this.postgresPassword,
      database: this.postgresDbName,
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: true,
      migrations: [`${__dirname}/..migrations/*.ts`],
    };
  }
}
