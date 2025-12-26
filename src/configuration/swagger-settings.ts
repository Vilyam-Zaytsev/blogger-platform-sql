import { IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class SwaggerSettings {
  @IsString()
  SWAGGER_USER: string;

  @IsString()
  SWAGGER_PASSWORD: string;

  @IsString()
  SWAGGER_PATH: string;

  @IsString()
  SWAGGER_SERVERS_URLS: string;

  constructor(private environmentVariables: EnvironmentVariable) {
    this.SWAGGER_USER = this.environmentVariables.SWAGGER_USER;
    this.SWAGGER_PASSWORD = this.environmentVariables.SWAGGER_PASSWORD;
    this.SWAGGER_PATH = this.environmentVariables.SWAGGER_PATH;
    this.SWAGGER_SERVERS_URLS = this.environmentVariables.SWAGGER_SERVERS_URLS;
  }
}
