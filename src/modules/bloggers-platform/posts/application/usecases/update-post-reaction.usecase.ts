import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateReactionDto } from '../../../reactions/dto/update-reaction.dto';
import { PostsRepository } from '../../infrastructure/posts.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { PostDb } from '../../types/post-db.type';
import { ReactionDb } from '../../../reactions/types/reaction-db.type';

export class UpdatePostReactionCommand {
  constructor(public readonly dto: UpdateReactionDto) {}
}

@CommandHandler(UpdatePostReactionCommand)
export class UpdatePostReactionUseCase implements ICommandHandler<UpdatePostReactionCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}

  async execute({ dto }: UpdatePostReactionCommand): Promise<void> {
    const post: PostDb | null = await this.postsRepository.getById(dto.parentId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${dto.parentId}) does not exist`,
      });
    }

    const reaction: ReactionDb | null = await this.postsRepository.getReactionByUserIdAndPostId(
      dto.userId,
      dto.parentId,
    );

    if (!reaction) {
      return await this.postsRepository.createReaction(dto);
    }

    await this.postsRepository.updateStatusPostReaction(reaction.id, dto.status);
  }
}
