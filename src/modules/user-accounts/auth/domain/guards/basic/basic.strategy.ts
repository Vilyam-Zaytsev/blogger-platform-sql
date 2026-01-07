import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BasicStrategy as Strategy } from 'passport-http';
import { Configuration } from '../../../../../../settings/configuration/configuration';
import { BusinessRulesSettings } from '../../../../../../settings/configuration/business-rules-settings';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BasicStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService<Configuration, true>) {
    super();
  }

  validate(username: string, password: string): boolean {
    const { ADMIN_LOGIN: validUsername, ADMIN_PASSWORD: validPassword }: BusinessRulesSettings =
      this.configService.get<BusinessRulesSettings>('businessRulesSettings');

    if (username === validUsername && password === validPassword) {
      return true;
    }

    throw new Error("The administrator's credentials were not verified");
  }
}
