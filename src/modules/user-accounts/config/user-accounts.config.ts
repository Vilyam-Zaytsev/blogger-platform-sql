import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { configValidator } from '../../../core/utils/config.validator';
import { Environments } from '../../../core/core.config';
import { CookieOptions } from 'express';

export enum SameSite {
  STRICT = 'strict',
  LAX = 'lax',
  NONE = 'none',
}

@Injectable()
export class UserAccountsConfig {
  @IsNotEmpty({
    message: 'Set Env variable JWT_EXPIRATION_AT, examples: 1h, 5m, 2d',
  })
  accessTokenExpireIn: string;

  @IsNotEmpty({
    message: 'Set Env variable JWT_EXPIRATION_RT, examples: 1h, 5m, 2d',
  })
  refreshTokenExpireIn: string;

  @IsNotEmpty({
    message: 'Set Env variable JWT_SECRET_AT, dangerous for security!',
  })
  accessTokenSecret: string;

  @IsNotEmpty({
    message: 'Set Env variable JWT_SECRET_RT, dangerous for security!',
  })
  refreshTokenSecret: string;

  @IsBoolean({
    message:
      'Set Env variable HTTP_ONLY to enable/disable HttpOnly flag for cookies. Example: true, available values: true, false, 0, 1',
  })
  httpOnly: boolean;

  @IsBoolean({
    message:
      'Set Env variable SECURE to enable/disable Secure flag for cookies (only HTTPS). Example: true, available values: true, false, 0, 1',
  })
  secure: boolean;

  @IsEnum(SameSite, {
    message:
      'Set Env variable SAME_SITE to control cookie cross-site behavior. Available values: ' +
      configValidator.getEnumValues(Environments).join(', '),
  })
  sameSite: CookieOptions['sameSite'];

  @IsNumber(
    {},
    {
      message:
        'Set Env variable MAX_AGE to specify cookie max age in milliseconds. Example: 3600000 (1 hour)',
    },
  )
  maxAge: number;

  @IsNotEmpty({
    message: 'Set Env variable PATH to define cookie path. Example: "/"',
  })
  path: string;

  @IsNumber(
    {},
    {
      message:
        'SESSION_CLEANUP_RETENTION_DAYS must be a number. Set the environment variable to specify the retention period in days. Example: SESSION_CLEANUP_RETENTION_DAYS=90 (soft-deleted sessions older than 90 days will be permanently deleted)',
    },
  )
  sessionCleanupRetentionDays: number;

  constructor(private configService: ConfigService<any, true>) {
    this.accessTokenExpireIn = this.configService.get('JWT_EXPIRATION_AT');

    this.refreshTokenExpireIn = this.configService.get('JWT_EXPIRATION_RT');

    this.accessTokenSecret = this.configService.get('JWT_SECRET_AT');

    this.refreshTokenSecret = this.configService.get('JWT_SECRET_RT');

    this.httpOnly = configValidator.convertToBoolean(
      this.configService.get('HTTP_ONLY'),
    ) as boolean;

    this.secure = configValidator.convertToBoolean(this.configService.get('SECURE')) as boolean;

    this.sameSite = this.configService.get('SAME_SITE');

    this.maxAge = Number(this.configService.get('MAX_AGE'));

    this.path = this.configService.get('PATH');

    this.sessionCleanupRetentionDays = Number(
      this.configService.get('SESSION_CLEANUP_RETENTION_DAYS'),
    );

    configValidator.validateConfig(this);
  }

  getCookieConfig(): CookieOptions {
    return {
      httpOnly: this.httpOnly,
      secure: this.secure,
      sameSite: this.sameSite,
      maxAge: this.maxAge,
      path: this.path,
    };
  }
}
