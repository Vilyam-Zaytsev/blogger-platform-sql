import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { add } from 'date-fns';
import { PasswordRecoveryInputDto } from '../../api/input-dto/password-recovery.input-dto';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { PasswordRecoveryEvent } from '../../domain/events/password-recovery.event';
import { User } from '../../../users/domain/entities/user.entity';

export class PasswordRecoveryCommand {
  constructor(public readonly dto: PasswordRecoveryInputDto) {}
}

@CommandHandler(PasswordRecoveryCommand)
export class PasswordRecoveryUseCase implements ICommandHandler<PasswordRecoveryCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ dto }: PasswordRecoveryCommand): Promise<void> {
    const user: User | null = await this.usersRepository.getByEmailWithPasswordRecoveryCode(
      dto.email,
    );

    if (!user) return;

    const recoveryCode: string = this.cryptoService.generateUUID();
    const expirationDate: Date = add(new Date(), { hours: 1, minutes: 1 });

    if (!user.passwordRecoveryCode) user.createPasswordRecoveryCode(recoveryCode, expirationDate);
    else user.updatePasswordRecoveryCode(recoveryCode, expirationDate);

    await this.usersRepository.save(user);

    this.eventBus.publish(new PasswordRecoveryEvent(user.email, recoveryCode));
  }
}
