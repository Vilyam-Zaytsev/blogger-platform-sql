import { Provider } from '@nestjs/common';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth-tokens.inject-constants';
import { JwtService } from '@nestjs/jwt';
import { Configuration } from '../../../../settings/configuration/configuration';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from '../../../../settings/configuration/api-settings';

export const AccessTokenProvider: Provider = {
  provide: ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [ConfigService],

  useFactory: (configService: ConfigService<Configuration, true>): JwtService => {
    const { accessToken } = configService.get<ApiSettings>('apiSettings').getJwtConfig();

    return new JwtService({
      secret: accessToken.secret,
      signOptions: {
        expiresIn: accessToken.expiresIn,
      },
    });
  },
};
