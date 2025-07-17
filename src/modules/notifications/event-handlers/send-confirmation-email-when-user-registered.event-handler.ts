import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EmailTemplate } from '../templates/types';
import { EmailTemplates } from '../templates/email.templates';
import { UserRegisteredEvent } from '../../user-accounts/auth/domain/events/user-registered.event';
import { EmailService } from '../services/email.service';

@EventsHandler(UserRegisteredEvent)
export class SendConfirmationEmailWhenUserRegisteredEventHandler
  implements IEventHandler<UserRegisteredEvent>
{
  constructor(
    private emailService: EmailService,
    private readonly templates: EmailTemplates,
  ) {}

  async handle(event: UserRegisteredEvent) {
    const { email, confirmationCode } = event;

    const template: EmailTemplate =
      this.templates.registrationEmail(confirmationCode);

    try {
      await this.emailService.sendEmail(email, template);
    } catch (e) {
      console.error('send email', e);
    }
  }
}
