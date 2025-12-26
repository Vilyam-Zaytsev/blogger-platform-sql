import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class ApiSettings {
  @IsNumber()
  PORT: number;

  @IsString()
  JWT_SECRET_AT: string;

  @IsString()
  JWT_SECRET_RT: string;

  @IsString()
  JWT_EXPIRATION_AT: string;

  @IsString()
  JWT_EXPIRATION_RT: string;

  @IsNumber()
  THROTTLE_TTL: number;

  @IsNumber()
  THROTTLE_LIMIT: number;

  @IsBoolean()
  IS_SWAGGER_ENABLED: boolean;

  @IsBoolean()
  SEND_INTERNAL_SERVER_ERROR_DETAILS: boolean;

  @IsBoolean()
  INCLUDE_TESTING_MODULE: boolean;

  @IsBoolean()
  HTTP_ONLY: boolean;

  @IsBoolean()
  SECURE: boolean;

  @IsString()
  SAME_SITE: string;

  @IsNumber()
  MAX_AGE: number;

  @IsString()
  PATH: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.PORT = Number(environmentVariables.PORT);

    this.JWT_SECRET_AT = environmentVariables.JWT_SECRET_AT;
    this.JWT_SECRET_RT = environmentVariables.JWT_SECRET_RT;
    this.JWT_EXPIRATION_AT = environmentVariables.JWT_EXPIRATION_AT;
    this.JWT_EXPIRATION_RT = environmentVariables.JWT_EXPIRATION_RT;

    this.THROTTLE_TTL = Number(environmentVariables.THROTTLE_TTL);
    this.THROTTLE_LIMIT = Number(environmentVariables.THROTTLE_LIMIT);

    this.IS_SWAGGER_ENABLED = environmentVariables.IS_SWAGGER_ENABLED === 'true';
    this.SEND_INTERNAL_SERVER_ERROR_DETAILS =
      environmentVariables.SEND_INTERNAL_SERVER_ERROR_DETAILS === 'true';
    this.INCLUDE_TESTING_MODULE = environmentVariables.INCLUDE_TESTING_MODULE === 'true';

    this.HTTP_ONLY = environmentVariables.HTTP_ONLY === 'true';
    this.SECURE = environmentVariables.SECURE === 'true';
    this.SAME_SITE = environmentVariables.SAME_SITE;
    this.MAX_AGE = Number(environmentVariables.MAX_AGE);
    this.PATH = environmentVariables.PATH;
  }
}
