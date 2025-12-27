import * as process from 'node:process';
import { ValidateNested, validateSync, ValidationError } from 'class-validator';
import * as dotenv from 'dotenv';
import { Environments, EnvironmentSettings } from './environment-settings';
import { ApiSettings } from './api-settings';
import { DatabaseSettings } from './database-settings';
import { SwaggerSettings } from './swagger-settings';
import { BusinessRulesSettings } from './business-rules-settings';

export const loadEnv = (): string[] => {
  const env = process.env.ENV as Environments;

  switch (env) {
    case Environments.DEVELOPMENT: {
      return ['src/env/.env.dev.local', 'src/env/.env.dev'];
    }

    case Environments.TEST: {
      return ['src/env/.env.test', 'src/env/.env'];
    }

    default: {
      return ['src/env/.env'];
    }
  }
};

dotenv.config({ path: loadEnv() });

export type EnvironmentVariable = { [key: string]: string };
export type ConfigurationType = Configuration;
export type ApiSettingsType = ConfigurationType['apiSettings'];
export type DatabaseSettingsType = ConfigurationType['databaseSettings'];
export type EnvironmentSettingsType = ConfigurationType['environmentSettings'];
export type BusinessRulesSettingsType = ConfigurationType['businessRulesSettings'];
export type SwaggerSettingsType = ConfigurationType['swaggerSettings'];

export class Configuration {
  @ValidateNested()
  apiSettings: ApiSettings;

  @ValidateNested()
  databaseSettings: DatabaseSettings;

  @ValidateNested()
  swaggerSettings: SwaggerSettings;

  @ValidateNested()
  environmentSettings: EnvironmentSettings;

  @ValidateNested()
  businessRulesSettings: BusinessRulesSettings;

  private constructor(configuration: Configuration) {
    Object.assign(this, configuration);
  }

  static createConfig(environmentVariables: EnvironmentVariable): Configuration {
    return new this({
      apiSettings: new ApiSettings(environmentVariables),
      databaseSettings: new DatabaseSettings(environmentVariables),
      swaggerSettings: new SwaggerSettings(environmentVariables),
      environmentSettings: new EnvironmentSettings(environmentVariables),
      businessRulesSettings: new BusinessRulesSettings(environmentVariables),
    });
  }
}

export function validate(environmentVariables: EnvironmentVariable) {
  const config: Configuration = Configuration.createConfig(environmentVariables);
  const errors: ValidationError[] = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return config;
}

export default () => {
  const environmentVariables = process.env as EnvironmentVariable;
  return Configuration.createConfig(environmentVariables);
};
