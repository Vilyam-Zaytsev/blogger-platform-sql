import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateSessionDto } from '../../../dto/create-session.dto';
import { SessionsRepository } from '../../../infrastructure/sessions.repository';
import { parseUserAgent } from '../../../../../../core/utils/user-agent-parser';
import { CreateSessionDomainDto } from '../../../domain/dto/create-session.domain.dto';

export class CreateSessionCommand {
  constructor(public dto: CreateSessionDto) {}
}

@CommandHandler(CreateSessionCommand)
export class CreateSessionUseCase
  implements ICommandHandler<CreateSessionCommand>
{
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({ dto }: CreateSessionCommand): Promise<void> {
    const deviceName: string = parseUserAgent(dto.userAgent);

    const createSessionDomainDto: CreateSessionDomainDto = {
      userId: dto.userId,
      deviceId: dto.deviceId,
      deviceName,
      ip: dto.ip,
      iat: new Date(dto.iat * 1000),
      exp: new Date(dto.exp * 1000),
    };

    await this.sessionsRepository.insertSession(createSessionDomainDto);
  }
}
