import { Provider } from '@nestjs/common';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth-tokens.inject-constants';
import { JwtService } from '@nestjs/jwt';
import { Configuration } from '../../../../settings/configuration/configuration';

export const AccessTokenProvider: Provider = {
  provide: ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [Configuration],

  useFactory: (config: Configuration): JwtService => {
    const { accessToken } = config.apiSettings.getJwtConfig();

    return new JwtService({
      secret: accessToken.secret,
      signOptions: {
        expiresIn: accessToken.expiresIn,
      },
    });
  },
};
