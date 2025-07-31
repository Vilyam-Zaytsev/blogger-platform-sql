import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionContextDto } from '../../../auth/domain/guards/dto/session-context.dto';
import { SessionsRepository } from '../../../auth/infrastructure/sessions.repository';

export class DeleteSessionsCommand {
  constructor(public readonly dto: SessionContextDto) {}
}

@CommandHandler(DeleteSessionsCommand)
export class DeleteSessionsUseCase
  implements ICommandHandler<DeleteSessionsCommand>
{
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({ dto }: DeleteSessionsCommand): Promise<void> {
    await this.sessionsRepository.softDeleteAllSessionsExceptCurrent(dto);
  }
}
