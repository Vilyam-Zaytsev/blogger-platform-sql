import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { SessionContextDto } from '../../../auth/domain/guards/dto/session-context.dto';
import { SessionsRepository } from '../../../auth/infrastructure/sessions.repository';
import { SessionDbType } from '../../../auth/types/session-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { Session } from '../../../auth/domain/entities/session.entity';

export class DeleteSessionCommand {
  constructor(
    public readonly dto: SessionContextDto,
    public readonly deviceId: string,
  ) {}
}

@CommandHandler(DeleteSessionCommand)
export class DeleteSessionUseCase implements ICommandHandler<DeleteSessionCommand> {
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({ dto, deviceId }: DeleteSessionCommand): Promise<void> {
    const session: Session | null = await this.sessionsRepository.getByDeviceId(deviceId);

    if (!session) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The session with ID (${deviceId}) does not exist`,
      });
    }

    if (session.userId !== dto.userId) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The user does not have permission to delete this session`,
      });
    }

    await this.sessionsRepository.softDeleteCurrentSession(session.id);
  }
}
