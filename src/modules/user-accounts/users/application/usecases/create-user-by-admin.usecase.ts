import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserDto } from '../../dto/create-user.dto';
import { UserValidationService } from '../services/user-validation.service';
import { UsersRepository } from '../../infrastructure/users.repository';
import { UserInputDto } from '../../api/input-dto/user.input-dto';
import { CryptoService } from '../services/crypto.service';
import { UserDbType } from '../../types/user-db.type';
import { CreateEmailConfirmationDto } from '../../../auth/dto/create-email-confirmation.dto';
import { ConfirmationStatus } from '../../types/email-confirmation-db.type';

export class CreateUserCommand {
  constructor(public readonly dto: UserInputDto) {}
}

@CommandHandler(CreateUserCommand)
export class CreateUserByAdminUseCase
  implements ICommandHandler<CreateUserCommand>
{
  constructor(
    private readonly userValidation: UserValidationService,
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute({ dto }: CreateUserCommand): Promise<number> {
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
      confirmationCode: null,
      expirationDate: null,
      confirmationStatus: ConfirmationStatus.Confirmed,
    };

    await this.usersRepository.insertEmailConfirmation(
      createEmailConfirmationDto,
    );

    return user.id;
  }
}
