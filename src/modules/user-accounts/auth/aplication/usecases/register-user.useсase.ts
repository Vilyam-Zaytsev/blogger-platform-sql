import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UserInputDto } from '../../../users/api/input-dto/user.input-dto';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import {
  ConfirmationStatus,
  EmailConfirmationDbType,
} from '../../../users/types/email-confirmation-db.type';
import { CreateEmailConfirmationDto } from '../../dto/create-email-confirmation.dto';
import { add } from 'date-fns';
import { UserDbType } from '../../../users/types/user-db.type';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { DomainException } from '../../../../../core/exceptions/damain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

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
    await this.userValidation.validateUniqueUser(dto);

    const passwordHash: string = await this.cryptoService.createPasswordHash(
      dto.password,
    );
    const createUserDto: CreateUserDto = {
      login: dto.login,
      email: dto.email,
      passwordHash,
    };

    const user: UserDbType =
      await this.usersRepository.insertUser(createUserDto);

    const createEmailConfirmationDto: CreateEmailConfirmationDto = {
      userId: user.id,
      confirmationCode: this.cryptoService.generateUUID(),
      expirationDate: add(new Date(), { hours: 1, minutes: 1 }),
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    };

    const emailConfirmation: EmailConfirmationDbType =
      await this.usersRepository.insertEmailConfirmationWithNotConfirmedStatus(
        createEmailConfirmationDto,
      );

    if (!emailConfirmation.confirmationCode) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Missing "confirmationCode" after creating EmailConfirmation for user ${user.id}`,
      });
    }

    const email: string = user.email;
    const confirmationCode: string = emailConfirmation.confirmationCode;

    this.eventBus.publish(new UserRegisteredEvent(email, confirmationCode));
  }
}
