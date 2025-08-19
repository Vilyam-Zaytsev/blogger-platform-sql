import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EmailTemplate } from '../templates/types';
import { EmailTemplates } from '../templates/email.templates';
import { EmailService } from '../services/email.service';
import { PasswordRecoveryEvent } from '../../user-accounts/auth/domain/events/password-recovery.event';

@EventsHandler(PasswordRecoveryEvent)
export class SendRecoveryCodeEmailWhenUserPasswordRecoveryEventHandler
  implements IEventHandler<PasswordRecoveryEvent>
{
  constructor(
    private emailService: EmailService,
    private readonly templates: EmailTemplates,
  ) {}

  async handle(event: PasswordRecoveryEvent) {
    const { email, recoveryCode } = event;

    const template: EmailTemplate = this.templates.passwordRecoveryEmail(recoveryCode);

    try {
      await this.emailService.sendEmail(email, template);
    } catch (e) {
      console.error('send email', e);
    }
  }
}
