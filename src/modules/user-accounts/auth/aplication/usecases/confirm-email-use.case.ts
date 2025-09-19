import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { RegistrationConfirmationCodeInputDto } from '../../api/input-dto/registration-confirmation-code.input-dto';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { ConfirmationStatus } from '../../domain/entities/email-confirmation-code.entity';
import { User } from '../../../users/domain/entities/user.entity';
import { DateService } from '../../../users/application/services/date.service';

export class ConfirmEmailCommand {
  constructor(public readonly dto: RegistrationConfirmationCodeInputDto) {}
}

@CommandHandler(ConfirmEmailCommand)
export class ConfirmEmailUseCase implements ICommandHandler<ConfirmEmailCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly dateService: DateService,
  ) {}

  async execute({ dto }: ConfirmEmailCommand): Promise<void> {
    const user: User | null = await this.usersRepository.getByEmailConfirmationCode(dto.code);

    this.validateConfirmationCode(user, dto.code);

    user.confirmEmail();
    await this.usersRepository.save(user);
  }

  private validateConfirmationCode(user: User | null, code: string): asserts user is User {
    if (!user) {
      throw new ValidationException([
        {
          message: `Confirmation code (${code}) incorrect or the email address has already been confirmed.`,
          field: 'code',
        },
      ]);
    }

    const { emailConfirmationCode } = user;

    if (
      emailConfirmationCode.expirationDate &&
      this.dateService.isExpired(emailConfirmationCode.expirationDate)
    ) {
      throw new ValidationException([
        {
          message: 'Email confirmation code has expired. Please request a new confirmation code.',
          field: 'code',
        },
      ]);
    }

    if (emailConfirmationCode.confirmationStatus === ConfirmationStatus.Confirmed) {
      throw new ValidationException([
        {
          message: 'Email address has already been confirmed.',
          field: 'code',
        },
      ]);
    }

    if (
      !emailConfirmationCode.expirationDate &&
      emailConfirmationCode.confirmationStatus === ConfirmationStatus.NotConfirmed
    ) {
      throw new ValidationException([
        {
          message: 'No active confirmation code found. Please request a new confirmation code.',
          field: 'code',
        },
      ]);
    }
  }
}
