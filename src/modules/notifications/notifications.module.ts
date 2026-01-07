import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './services/email.service';
import { EmailTemplates } from './templates/email.templates';
import { SendConfirmationEmailWhenUserRegisteredEventHandler } from './event-handlers/send-confirmation-email-when-user-registered.event-handler';
import { ResendConfirmationEmailWhenUserRegisteredEventHandler } from './event-handlers/resend-confirmation-email-when-user-registered.event-handler';
import { SendRecoveryCodeEmailWhenUserPasswordRecoveryEventHandler } from './event-handlers/send-recovery-code-email-when-user-password-recovery.event-handler';
import { Configuration } from '../../settings/configuration/configuration';
import { BusinessRulesSettings } from '../../settings/configuration/business-rules-settings';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => {
        const { EMAIL_APP: email, EMAIL_APP_PASSWORD: password }: BusinessRulesSettings =
          configService.get<BusinessRulesSettings>('businessRulesSettings');

        return {
          transport: `smtps://${encodeURIComponent(email)}:${encodeURIComponent(password)}@smtp.gmail.com`,
          defaults: { from: `Blogger Platform <${email}>` },
        };
      },
    }),
  ],
  providers: [
    EmailService,
    EmailTemplates,
    SendConfirmationEmailWhenUserRegisteredEventHandler,
    ResendConfirmationEmailWhenUserRegisteredEventHandler,
    SendRecoveryCodeEmailWhenUserPasswordRecoveryEventHandler,
  ],
  exports: [EmailService],
})
export class NotificationsModule {}
