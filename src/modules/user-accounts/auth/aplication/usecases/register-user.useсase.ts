import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UserInputDto } from '../../../users/api/input-dto/user.input-dto';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { User } from '../../../users/domain/entities/user.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class RegisterUserCommand {
  constructor(public dto: UserInputDto) {}
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserUseCase implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly userValidation: UserValidationService,
    private readonly usersRepository: UsersRepository,
    private readonly userFactory: UsersFactory,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ dto }: RegisterUserCommand): Promise<void> {
    await this.userValidation.validateUniqueUser(dto.login, dto.email);
    const user: User = await this.userFactory.create(dto);

    if (!user.emailConfirmationCode.confirmationCode) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message:
          'Email confirmation code is not generated. Registration failed due to internal error.',
      });
    }

    await this.usersRepository.save(user);

    this.eventBus.publish(
      new UserRegisteredEvent(user.email, user.emailConfirmationCode.confirmationCode),
    );
  }
}
