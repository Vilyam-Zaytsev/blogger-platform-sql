import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { SessionContextDto } from '../../domain/guards/dto/session-context.dto';
import { SessionsRepository } from '../../../sessions/infrastructure/sessions.repository';
import { Session } from '../../../sessions/domain/entities/session.entity';

export class LogoutCommand {
  constructor(public readonly sessionContextDto: SessionContextDto) {}
}

@CommandHandler(LogoutCommand)
export class LogoutUseCase implements ICommandHandler<LogoutCommand> {
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({ sessionContextDto }: LogoutCommand): Promise<void> {
    const session: Session | null = await this.sessionsRepository.getByDeviceId(
      sessionContextDto.deviceId,
    );

    if (!session) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: `Unauthorized`,
      });
    }

    await this.sessionsRepository.softDeleteCurrentSession(session.id);
  }
}
