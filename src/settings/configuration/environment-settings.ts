import { IsEnum } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export enum Environments {
  DEVELOPMENT = 'DEVELOPMENT',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
  TEST = 'TEST',
}

export class EnvironmentSettings {
  @IsEnum(Environments)
  private ENV: Environments;

  constructor(private environmentVariables: EnvironmentVariable) {
    this.ENV = this.environmentVariables.ENV as Environments;
  }

  get isProduction() {
    return this.ENV === Environments.PRODUCTION;
  }

  get isStaging() {
    return this.ENV === Environments.STAGING;
  }

  get isTesting() {
    return this.ENV === Environments.TEST;
  }

  get isDevelopment() {
    return this.ENV === Environments.DEVELOPMENT;
  }

  get currentEnv() {
    return this.ENV;
  }
}
