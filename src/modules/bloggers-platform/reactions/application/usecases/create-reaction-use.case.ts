import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReactionsRepository } from '../../infrastructure/reactions-repository';
import { CreateReactionDto } from '../../dto/create-reaction.dto';

export class CreateReactionCommand {
  constructor(public readonly dto: CreateReactionDto) {}
}

@CommandHandler(CreateReactionCommand)
export class CreateReactionUseCase implements ICommandHandler<CreateReactionCommand> {
  constructor(private readonly reactionsRepository: ReactionsRepository) {}

  async execute({ dto }: CreateReactionCommand): Promise<number> {
    return await this.reactionsRepository.insertReaction(dto);
  }
}
