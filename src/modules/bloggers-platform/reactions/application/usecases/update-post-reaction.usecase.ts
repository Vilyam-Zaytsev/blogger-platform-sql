import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateReactionDto } from '../../dto/update-reaction.dto';
import { PostsRepository } from '../../../posts/infrastructure/posts.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Post } from '../../../posts/domain/entities/post.entity';
import { Reaction } from '../../domain/entities/reaction.entity';
import { ReactionsRepository } from '../../infrastructure/reactions.repository';

export class UpdatePostReactionCommand {
  constructor(public readonly dto: UpdateReactionDto) {}
}

@CommandHandler(UpdatePostReactionCommand)
export class UpdatePostReactionUseCase implements ICommandHandler<UpdatePostReactionCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly reactionsRepository: ReactionsRepository,
  ) {}

  async execute({ dto }: UpdatePostReactionCommand): Promise<void> {
    const post: Post | null = await this.postsRepository.getById(dto.parentId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${dto.parentId}) does not exist`,
      });
    }

    const reaction: Reaction | null = await this.reactionsRepository.getReactionByUserIdAndPostId(
      dto.userId,
      dto.parentId,
    );

    if (!reaction) {
      const reaction: Reaction = Reaction.createForPost(dto);
      await this.reactionsRepository.save(reaction);

      return;
    }

    reaction.updateStatus(dto.status);
    await this.reactionsRepository.save(reaction);
  }
}
