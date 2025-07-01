import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { configValidationUtility } from './utils/config-validation.utility';

export enum Environments {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TESTING = 'testing',
}

@Injectable()
export class CoreConfig {
  @IsNumber({}, { message: 'Set Env variable PORT, example: 3000' })
  port: number;

  @IsNotEmpty({
    message: 'Set Env variable MONGO_URI, example: mongodb://localhost:27017',
  })
  mongoURL: string;

  @IsNotEmpty({
    message: 'Set Env variable DB_NAME, example: blogger-platform-dev',
  })
  dbName: string;

  @IsEnum(Environments, {
    message:
      'Set correct NODE_ENV value, available values: ' +
      configValidationUtility.getEnumValues(Environments).join(', '),
  })
  env: string;

  @IsNotEmpty({
    message: 'Set Env variable ADMIN_LOGIN, example: "admin365"',
  })
  adminLogin: string;

  @IsNotEmpty({
    message: 'Set Env variable ADMIN_PASSWORD',
  })
  adminPassword: string;

  @IsBoolean({
    message:
      'Set Env variable IS_SWAGGER_ENABLED to enable/disable Swagger, example: true, available values: true, false',
  })
  isSwaggerEnabled: boolean;

  @IsBoolean({
    message:
      'Set Env variable INCLUDE_TESTING_MODULE to enable/disable Dangerous for production TestingModule, example: true, available values: true, false, 0, 1',
  })
  includeTestingModule: boolean;

  @IsBoolean({
    message:
      'Set Env variable SEND_INTERNAL_SERVER_ERROR_DETAILS to enable/disable Dangerous for production internal server error details (message, etc), example: true, available values: true, false, 0, 1',
  })
  sendInternalServerErrorDetails: boolean;

  @IsBoolean({
    message:
      'Set the Env TEST_LOGGING_ENABLED variable to enable/disable logging of information about test results, for example: true, available values: true, false, 0, 1',
  })
  testLoggingEnabled: boolean;

  @IsNumber(
    {},
    {
      message:
        'Set Env variable THROTTLE_TTL to a numeric value. Example: 10 (in seconds)',
    },
  )
  throttleTtl: number;

  @IsNumber(
    {},
    {
      message:
        'Set Env variable THROTTLE_LIMIT to a numeric value. Example: 5 (requests per TTL)',
    },
  )
  throttleLimit: number;

  constructor(private configService: ConfigService<any, true>) {
    this.port = Number(this.configService.get('PORT'));

    this.mongoURL = this.configService.get('MONGO_URL');

    this.dbName = this.configService.get('DB_NAME');

    this.env = this.configService.get('NODE_ENV');

    this.adminLogin = this.configService.get('ADMIN_LOGIN');

    this.adminPassword = this.configService.get('ADMIN_PASSWORD');

    this.isSwaggerEnabled = configValidationUtility.convertToBoolean(
      this.configService.get('IS_SWAGGER_ENABLED'),
    ) as boolean;

    this.includeTestingModule = configValidationUtility.convertToBoolean(
      this.configService.get('INCLUDE_TESTING_MODULE'),
    ) as boolean;

    this.sendInternalServerErrorDetails =
      configValidationUtility.convertToBoolean(
        this.configService.get('SEND_INTERNAL_SERVER_ERROR_DETAILS'),
      ) as boolean;

    this.testLoggingEnabled = configValidationUtility.convertToBoolean(
      this.configService.get('TEST_LOGGING_ENABLED'),
    ) as boolean;

    this.throttleTtl = Number(this.configService.get('THROTTLE_TTL'));

    this.throttleLimit = Number(this.configService.get('THROTTLE_LIMIT'));

    configValidationUtility.validateConfig(this);
  }
}
