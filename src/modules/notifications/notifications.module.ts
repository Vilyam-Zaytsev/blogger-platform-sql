import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { NotificationsConfig } from './config/notifications.config';
import { EmailService } from './services/email.service';
import { EmailTemplates } from './templates/email.templates';
import { SendConfirmationEmailWhenUserRegisteredEventHandler } from './event-handlers/send-confirmation-email-when-user-registered.event-handler';
import { ResendConfirmationEmailWhenUserRegisteredEventHandler } from './event-handlers/resend-confirmation-email-when-user-registered.event-handler';
import { SendRecoveryCodeEmailWhenUserPasswordRecoveryEventHandler } from './event-handlers/send-recovery-code-email-when-user-password-recovery.event-handler';
import { EnvModule } from '../../env/env.module';
import { Configuration } from '../../settings/configuration/configuration';
import { BusinessRulesSettings } from '../../settings/configuration/business-rules-settings';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [EnvModule],
      inject: [Configuration],

      useFactory: (config: Configuration) => {
        const businessRulesSettings: BusinessRulesSettings = config.businessRulesSettings;
        const email: string = businessRulesSettings.EMAIL_APP;
        const password: string = businessRulesSettings.EMAIL_APP_PASSWORD;

        if (!email || !password) {
          throw new Error('EMAIL and EMAIL_PASSWORD must be defined in environment variables');
        }

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
    NotificationsConfig,
    SendConfirmationEmailWhenUserRegisteredEventHandler,
    ResendConfirmationEmailWhenUserRegisteredEventHandler,
    SendRecoveryCodeEmailWhenUserPasswordRecoveryEventHandler,
  ],
  exports: [EmailService],
})
export class NotificationsModule {}
