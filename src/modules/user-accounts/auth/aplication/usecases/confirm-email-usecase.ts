import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { RegistrationConfirmationCodeInputDto } from '../../api/input-dto/registration-confirmation-code.input-dto';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { ConfirmationStatus } from '../../domain/entities/email-confirmation-code.entity';
import { User } from '../../../users/domain/entities/user.entity';

export class ConfirmEmailCommand {
  constructor(public readonly dto: RegistrationConfirmationCodeInputDto) {}
}

@CommandHandler(ConfirmEmailCommand)
export class ConfirmEmailUsecase implements ICommandHandler<ConfirmEmailCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute({ dto }: ConfirmEmailCommand): Promise<void> {
    const user: User | null = await this.usersRepository.getByEmailConfirmationCode(dto.code);

    //TODO: есть ли необходимость выносить эту проверку в обдельную функцию/метод??? разбить на три ошибки
    if (
      !user ||
      !user.emailConfirmationCode.confirmationCode ||
      !user.emailConfirmationCode.expirationDate ||
      new Date(user.emailConfirmationCode.expirationDate) < new Date() ||
      user.emailConfirmationCode.confirmationStatus === ConfirmationStatus.Confirmed
    ) {
      throw new ValidationException([
        {
          message: `Confirmation code (${dto.code}) incorrect or the email address has already been confirmed`,
          field: 'code',
        },
      ]);
    }

    user.confirmEmail();
    await this.usersRepository.save(user);
  }
}
