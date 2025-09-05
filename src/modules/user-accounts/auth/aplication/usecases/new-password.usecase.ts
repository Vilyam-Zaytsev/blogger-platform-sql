import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NewPasswordInputDto } from '../../api/input-dto/new-password-input.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { User } from '../../../users/domain/entities/user.entity';

export class NewPasswordCommand {
  constructor(public readonly dto: NewPasswordInputDto) {}
}

@CommandHandler(NewPasswordCommand)
export class NewPasswordUseCase implements ICommandHandler<NewPasswordCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute({ dto }: NewPasswordCommand): Promise<void> {
    const user: User | null = await this.usersRepository.getByPasswordRecoveryCode(
      dto.recoveryCode,
    );

    if (!user) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Recovery code incorrect',
      });
    }

    if (
      user.passwordRecoveryCode.expirationDate &&
      new Date(user.passwordRecoveryCode.expirationDate) < new Date()
    ) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'The code has expired',
      });
    }

    const passwordHash: string = await this.cryptoService.createPasswordHash(dto.newPassword);

    user.updatePasswordHash(passwordHash);
    await this.usersRepository.save(user);
  }
}
