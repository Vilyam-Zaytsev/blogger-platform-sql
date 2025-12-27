import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class BusinessRulesSettings {
  @IsString()
  EMAIL_APP: string;

  @IsString()
  EMAIL_APP_PASSWORD: string;

  @IsString()
  ADMIN_LOGIN: string;

  @IsString()
  ADMIN_PASSWORD: string;

  @IsNumber()
  GAME_FINISH_TIMEOUT_MS: number;

  @IsNumber()
  SESSION_CLEANUP_RETENTION_DAYS: number;

  @IsBoolean()
  TEST_LOGGING_ENABLED: boolean;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.EMAIL_APP = environmentVariables.EMAIL_APP;
    this.EMAIL_APP_PASSWORD = environmentVariables.EMAIL_APP_PASSWORD;

    this.ADMIN_LOGIN = environmentVariables.ADMIN_LOGIN;
    this.ADMIN_PASSWORD = environmentVariables.ADMIN_PASSWORD;

    this.GAME_FINISH_TIMEOUT_MS = Number.parseInt(environmentVariables.GAME_FINISH_TIMEOUT_MS);
    this.SESSION_CLEANUP_RETENTION_DAYS = Number.parseInt(
      environmentVariables.SESSION_CLEANUP_RETENTION_DAYS,
    );

    this.TEST_LOGGING_ENABLED = environmentVariables.TEST_LOGGING_ENABLED === 'true';
  }
}
