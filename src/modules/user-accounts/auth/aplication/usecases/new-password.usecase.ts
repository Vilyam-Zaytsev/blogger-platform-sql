import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NewPasswordInputDto } from '../../api/input-dto/new-password-input.dto';
import { UsersRepository } from 'src/modules/user-accounts/users/infrastructure/users.repository';
import { CryptoService } from 'src/modules/user-accounts/users/application/services/crypto.service';
import { DomainException } from '../../../../../core/exceptions/damain-exceptions';
import { DomainExceptionCode } from 'src/core/exceptions/domain-exception-codes';
import { PasswordRecoveryDbType } from '../../types/password-recovery-db.type';
import { UpdatePassword } from '../types/update-password.type';

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
    const passwordRecovery: PasswordRecoveryDbType | null =
      await this.usersRepository.getPasswordRecoveryByRecoveryCode(
        dto.recoveryCode,
      );

    if (!passwordRecovery) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Recovery code incorrect',
      });
    }

    if (
      passwordRecovery.expirationDate &&
      new Date(passwordRecovery.expirationDate) < new Date()
    ) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'The code has expired',
      });
    }

    const hash: string = await this.cryptoService.createPasswordHash(
      dto.newPassword,
    );

    const updatePasswordDto: UpdatePassword = {
      userId: passwordRecovery.userId,
      newPasswordHash: hash,
    };

    await this.usersRepository.updatePassword(updatePasswordDto);
  }
}
