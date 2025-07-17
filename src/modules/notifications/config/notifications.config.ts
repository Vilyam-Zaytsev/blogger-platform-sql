import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { configValidator } from '../../../core/utils/config.validator';

@Injectable()
export class NotificationsConfig {
  @IsEmail(
    {},
    {
      message:
        "Set Env variable EMAIL_APP with a valid email address. Example: 'someone@example.com'",
    },
  )
  emailApp: string;

  @IsNotEmpty({
    message: 'Set Env variable EMAIL_APP_PASSWORD',
  })
  emailAppPassword: string;

  constructor(private configService: ConfigService<any, true>) {
    this.emailApp = this.configService.get('EMAIL_APP');

    this.emailAppPassword = this.configService.get('EMAIL_APP_PASSWORD');

    configValidator.validateConfig(this);
  }
}
