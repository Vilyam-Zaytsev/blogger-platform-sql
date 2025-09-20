import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { parseUserAgent } from '../../../../../core/utils/user-agent.parser';
import { SessionCreateDomainDto } from '../../domain/dto/session.create-domain.dto';
import { Session } from '../../domain/entities/session.entity';

export class CreateSessionCommand {
  constructor(public readonly dto: CreateSessionDto) {}
}

@CommandHandler(CreateSessionCommand)
export class CreateSessionUseCase implements ICommandHandler<CreateSessionCommand> {
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({ dto }: CreateSessionCommand): Promise<void> {
    const deviceName: string = parseUserAgent(dto.userAgent);

    const createSessionDomainDto: SessionCreateDomainDto = {
      userId: dto.userId,
      deviceId: dto.deviceId,
      deviceName,
      ip: dto.ip,
      iat: new Date(dto.iat * 1000),
      exp: new Date(dto.exp * 1000),
    };

    const session: Session = Session.create(createSessionDomainDto);
    await this.sessionsRepository.save(session);
  }
}
