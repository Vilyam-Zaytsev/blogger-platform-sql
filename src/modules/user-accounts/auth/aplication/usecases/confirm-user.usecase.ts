import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { RegistrationConfirmationCodeInputDto } from '../../api/input-dto/registration-confirmation-code.input-dto';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { EmailConfirmationDbType } from '../../types/email-confirmation-db.type';
import { UpdateEmailConfirmationDto } from '../../dto/create-email-confirmation.dto';
import { ConfirmationStatus } from '../../domain/entities/email-confirmation-code.entity';

export class ConfirmUserCommand {
  constructor(public readonly dto: RegistrationConfirmationCodeInputDto) {}
}

@CommandHandler(ConfirmUserCommand)
export class ConfirmUserUseCase implements ICommandHandler<ConfirmUserCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute({ dto }: ConfirmUserCommand): Promise<void> {
    const emailConfirmation: EmailConfirmationDbType | null =
      await this.usersRepository.getEmailConfirmationByConfirmationCode(dto.code);

    if (
      !emailConfirmation ||
      !emailConfirmation.confirmationCode ||
      !emailConfirmation.expirationDate ||
      new Date(emailConfirmation.expirationDate) < new Date() ||
      emailConfirmation.confirmationStatus === ConfirmationStatus.Confirmed
    ) {
      throw new ValidationException([
        {
          message: `Confirmation code (${dto.code}) incorrect or the email address has already been confirmed`,
          field: 'code',
        },
      ]);
    }

    const updateEmailConfirmationDto: UpdateEmailConfirmationDto = {
      userId: emailConfirmation.userId,
      confirmationCode: null,
      expirationDate: null,
      confirmationStatus: ConfirmationStatus.Confirmed,
    };

    await this.usersRepository.updateEmailConfirmation(updateEmailConfirmationDto);
  }
}
