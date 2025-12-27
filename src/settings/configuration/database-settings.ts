import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from '../../modules/database/config/snake-naming.strategy';
import { EnvironmentVariable } from './configuration';

export class DatabaseSettings {
  @IsString()
  POSTGRES_HOST: string;

  @IsNumber()
  POSTGRES_PORT: number;

  @IsString()
  POSTGRES_USER_NAME: string;

  @IsString()
  POSTGRES_PASSWORD: string;

  @IsString()
  POSTGRES_DATA_BASE: string;

  @IsBoolean()
  POSTGRES_AUTO_LOAD_ENTITIES: boolean;

  @IsBoolean()
  POSTGRES_SYNCHRONIZE: boolean;

  @IsBoolean()
  POSTGRES_LOGGING: boolean;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.POSTGRES_HOST = this.environmentVariables.POSTGRES_HOST;
    this.POSTGRES_PORT = Number(this.environmentVariables.POSTGRES_PORT);

    this.POSTGRES_USER_NAME = this.environmentVariables.POSTGRES_USER_NAME;
    this.POSTGRES_PASSWORD = this.environmentVariables.POSTGRES_PASSWORD;
    this.POSTGRES_DATA_BASE = this.environmentVariables.POSTGRES_DATA_BASE;

    this.POSTGRES_AUTO_LOAD_ENTITIES =
      this.environmentVariables.POSTGRES_AUTO_LOAD_ENTITIES === 'true';
    this.POSTGRES_SYNCHRONIZE = this.environmentVariables.POSTGRES_SYNCHRONIZE === 'true';
    this.POSTGRES_LOGGING = this.environmentVariables.POSTGRES_LOGGING === 'true';
  }

  getTypeOrmConfigForPostgres(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.POSTGRES_HOST,
      port: this.POSTGRES_PORT,
      username: this.POSTGRES_USER_NAME,
      password: this.POSTGRES_PASSWORD,
      database: this.POSTGRES_DATA_BASE,
      autoLoadEntities: this.POSTGRES_AUTO_LOAD_ENTITIES,
      synchronize: this.POSTGRES_SYNCHRONIZE,
      logging: this.POSTGRES_LOGGING,
      namingStrategy: new SnakeNamingStrategy(),
    };
  }
}
