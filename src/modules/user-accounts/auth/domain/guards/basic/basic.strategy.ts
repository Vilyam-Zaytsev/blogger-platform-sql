import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BasicStrategy as Strategy } from 'passport-http';
import { Configuration } from '../../../../../../settings/configuration/configuration';
import { BusinessRulesSettings } from '../../../../../../settings/configuration/business-rules-settings';

@Injectable()
export class BasicStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: Configuration) {
    super();
  }

  validate(username: string, password: string): boolean {
    const businessRulesSettings: BusinessRulesSettings = this.config.businessRulesSettings;
    const validUsername: string = businessRulesSettings.ADMIN_LOGIN;
    const validPassword: string = businessRulesSettings.ADMIN_PASSWORD;

    if (username === validUsername && password === validPassword) {
      return true;
    }
    throw new Error("The administrator's credentials were not verified");
  }
}
