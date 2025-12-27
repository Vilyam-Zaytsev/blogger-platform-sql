import { IsBoolean, IsEnum, IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export enum SameSite {
  STRICT = 'strict',
  LAX = 'lax',
  NONE = 'none',
}

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
  SEND_INTERNAL_SERVER_ERROR_DETAILS: boolean;

  @IsBoolean()
  INCLUDE_TESTING_MODULE: boolean;

  @IsBoolean()
  HTTP_ONLY: boolean;

  @IsBoolean()
  SECURE: boolean;

  @IsEnum(SameSite)
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

    this.SEND_INTERNAL_SERVER_ERROR_DETAILS =
      environmentVariables.SEND_INTERNAL_SERVER_ERROR_DETAILS === 'true';
    this.INCLUDE_TESTING_MODULE = environmentVariables.INCLUDE_TESTING_MODULE === 'true';

    this.HTTP_ONLY = environmentVariables.HTTP_ONLY === 'true';
    this.SECURE = environmentVariables.SECURE === 'true';
    this.SAME_SITE = environmentVariables.SAME_SITE;
    this.MAX_AGE = Number(environmentVariables.MAX_AGE);
    this.PATH = environmentVariables.PATH;
  }

  getCookieOptions() {
    return {
      httpOnly: this.HTTP_ONLY,
      secure: this.SECURE,
      sameSite: this.SAME_SITE,
      maxAge: this.MAX_AGE,
      path: this.PATH,
    };
  }

  getJwtConfig() {
    return {
      accessToken: {
        secret: this.JWT_SECRET_AT,
        expiresIn: this.JWT_EXPIRATION_AT,
      },
      refreshToken: {
        secret: this.JWT_SECRET_RT,
        expiresIn: this.JWT_EXPIRATION_RT,
      },
    };
  }
}
