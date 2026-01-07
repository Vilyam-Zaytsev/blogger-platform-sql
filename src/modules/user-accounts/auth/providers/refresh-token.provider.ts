import { Provider } from '@nestjs/common';
import { REFRESH_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth-tokens.inject-constants';
import { JwtService } from '@nestjs/jwt';
import { Configuration } from '../../../../settings/configuration/configuration';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from '../../../../settings/configuration/api-settings';

export const RefreshTokenProvider: Provider = {
  provide: REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Configuration, true>): JwtService => {
    const { refreshToken } = configService.get<ApiSettings>('apiSettings').getJwtConfig();

    return new JwtService({
      secret: refreshToken.secret,
      signOptions: {
        expiresIn: refreshToken.expiresIn,
      },
    });
  },
};
