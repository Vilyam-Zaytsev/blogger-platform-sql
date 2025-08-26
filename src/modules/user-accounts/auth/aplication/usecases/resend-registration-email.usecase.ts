import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { add } from 'date-fns';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { RegistrationEmailResandingInputDto } from '../../api/input-dto/registration-email-resending.input-dto';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { UserDbType } from '../../../users/types/user-db.type';
import { EmailConfirmationDbType } from '../../types/email-confirmation-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { UpdateEmailConfirmationDto } from '../../dto/create-email-confirmation.dto';
import { UserResendRegisteredEvent } from '../../domain/events/user-resend-registered.event';
import { ConfirmationStatus } from '../../domain/entities/email-confirmation-code.entity';

export class ResendRegistrationEmailCommand {
  constructor(public readonly dto: RegistrationEmailResandingInputDto) {}
}

@CommandHandler(ResendRegistrationEmailCommand)
export class ResendRegistrationEmailUseCase
  implements ICommandHandler<ResendRegistrationEmailCommand>
{
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ dto }: ResendRegistrationEmailCommand): Promise<void> {
    const user: UserDbType | null = await this.usersRepository.getByEmail(dto.email);

    if (!user) {
      throw new ValidationException([
        {
          message: `The user with this email address (${dto.email}) was not found`,
          field: 'email',
        },
      ]);
    }

    const emailConfirmation: EmailConfirmationDbType | null =
      await this.usersRepository.getEmailConfirmationByUserId(user.id);

    if (!emailConfirmation) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `Email confirmation request does not exist for user with id: ${user.id}`,
      });
    }

    if (emailConfirmation.confirmationStatus === ConfirmationStatus.Confirmed) {
      throw new ValidationException([
        {
          message: `The email address (${dto.email}) has already been verified`,
          field: 'email',
        },
      ]);
    }

    const confirmationCode: string = this.cryptoService.generateUUID();
    const expirationDate: Date = add(new Date(), { hours: 1, minutes: 1 });

    const updateEmailConfirmationDto: UpdateEmailConfirmationDto = {
      userId: user.id,
      confirmationCode,
      expirationDate,
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    };

    await this.usersRepository.updateEmailConfirmation(updateEmailConfirmationDto);

    this.eventBus.publish(new UserResendRegisteredEvent(user.email, confirmationCode));
  }
}
