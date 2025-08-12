import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateReactionDto } from '../../../reactions/dto/update-reaction.dto';
import { PostsRepository } from '../../infrastructure/posts.repository';
import { UpdateReactionsCommand } from '../../../reactions/application/usecases/update-reactions.usecase';

export class UpdatePostReactionCommand {
  constructor(public readonly dto: UpdateReactionDto) {}
}

@CommandHandler(UpdatePostReactionCommand)
export class UpdatePostReactionUseCase implements ICommandHandler<UpdatePostReactionCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ dto }: UpdatePostReactionCommand): Promise<void> {
    await this.postsRepository.getByIdOrNotFoundFail(dto.parentId);

    await this.commandBus.execute(new UpdateReactionsCommand(dto));
  }
}
