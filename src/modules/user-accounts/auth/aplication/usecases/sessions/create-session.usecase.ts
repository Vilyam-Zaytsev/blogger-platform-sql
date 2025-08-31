import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateSessionDto } from '../../../dto/create-session.dto';
import { SessionsRepository } from '../../../infrastructure/sessions.repository';
import { parseUserAgent } from '../../../../../../core/utils/user-agent.parser';
import { SessionCreateDomainDto } from '../../../domain/dto/session.create-domain.dto';
import { Session } from '../../../domain/entities/session.entity';
import { User } from 'src/modules/user-accounts/users/domain/entities/user.entity';
import { UsersRepository } from '../../../../users/infrastructure/users.repository';

export class CreateSessionCommand {
  constructor(public readonly dto: CreateSessionDto) {}
}

@CommandHandler(CreateSessionCommand)
export class CreateSessionUseCase implements ICommandHandler<CreateSessionCommand> {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute({ dto }: CreateSessionCommand): Promise<void> {
    const user: User = await this.usersRepository.getByIdOrNotFoundFail(dto.userId);
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
    //TODO: правильно ли я настраиваю связь с пользователем?
    session.user = user;

    await this.sessionsRepository.save(session);
  }
}
