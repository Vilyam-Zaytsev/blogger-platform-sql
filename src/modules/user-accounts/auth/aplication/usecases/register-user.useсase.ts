import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UserInputDto } from '../../../users/api/input-dto/user.input-dto';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { ConfirmationStatus } from '../../types/email-confirmation-db.type';
import { CreateEmailConfirmationDto } from '../../dto/create-email-confirmation.dto';
import { add } from 'date-fns';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';

export class RegisterUserCommand {
  constructor(public dto: UserInputDto) {}
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserUseCase
  implements ICommandHandler<RegisterUserCommand>
{
  constructor(
    private readonly userValidation: UserValidationService,
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ dto }: RegisterUserCommand): Promise<void> {
    const { login, email, password } = dto;

    await this.userValidation.validateUniqueUser(login, email);

    const passwordHash: string =
      await this.cryptoService.createPasswordHash(password);
    const createUserDto: CreateUserDto = {
      login,
      email,
      passwordHash,
    };

    const userId: number = await this.usersRepository.insertUser(createUserDto);

    const createEmailConfirmationDto: CreateEmailConfirmationDto = {
      userId: userId,
      confirmationCode: this.cryptoService.generateUUID(),
      expirationDate: add(new Date(), { hours: 1, minutes: 1 }),
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    };

    const confirmationCode: string =
      await this.usersRepository.insertEmailConfirmation(
        createEmailConfirmationDto,
      );

    this.eventBus.publish(new UserRegisteredEvent(email, confirmationCode));
  }
}
