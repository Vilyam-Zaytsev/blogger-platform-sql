import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GamesRepository } from '../../infrastructure/games.repository';

export class ConnectToGameCommand {
  constructor(public readonly userId: number) {}
}

@CommandHandler(ConnectToGameCommand)
export class ConnectToGameUseCase implements ICommandHandler<ConnectToGameCommand> {
  constructor(private readonly gamesRepository: GamesRepository) {}

  async execute({ userId }: ConnectToGameCommand): Promise<number> {
    return 1;
  }
}
