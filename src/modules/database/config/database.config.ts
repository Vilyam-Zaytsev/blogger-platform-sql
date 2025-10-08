import { Injectable } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsNumber } from 'class-validator';
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

  @IsBoolean({
    message: 'Set Env variable AUTO_LOAD_ENTITIES to boolean value (true or false)',
  })
  autoLoadEntities: boolean;

  @IsBoolean({
    message: 'Set Env variable SYNCHRONIZE to boolean value (true or false)',
  })
  synchronize: boolean;

  @IsBoolean({
    message: 'Set Env variable LOGGING to boolean value (true or false)',
  })
  logging: boolean;

  constructor(private configService: ConfigService<any, true>) {
    this.postgresHost = this.configService.get('POSTGRES_HOST');

    this.postgresPort = Number(this.configService.get('POSTGRES_PORT'));

    this.postgresUser = this.configService.get('POSTGRES_USER');

    this.postgresPassword = this.configService.get('POSTGRES_PASSWORD');

    this.postgresDbName = this.configService.get('POSTGRES_DB_NAME');

    this.autoLoadEntities = configValidator.convertToBoolean(
      this.configService.get('AUTO_LOAD_ENTITIES'),
    ) as boolean;

    this.synchronize = configValidator.convertToBoolean(
      this.configService.get('SYNCHRONIZE'),
    ) as boolean;

    this.logging = configValidator.convertToBoolean(this.configService.get('LOGGING')) as boolean;

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
      autoLoadEntities: this.autoLoadEntities,
      synchronize: this.synchronize,
      logging: this.logging,
    };
  }
}
