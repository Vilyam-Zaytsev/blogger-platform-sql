import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../../posts/infrastructure/posts.repository';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { CreateCommentDto } from '../../dto/create-comment.dto';
import { Inject } from '@nestjs/common';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool } from 'pg';
import { CreateCommentDomainDto } from '../../domain/dto/create-comment.domain-dto';
import { PostDb } from '../../../posts/types/post-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class CreateCommentCommand {
  constructor(public readonly dto: CreateCommentDto) {}
}

@CommandHandler(CreateCommentCommand)
export class CreateCommentUseCase implements ICommandHandler<CreateCommentCommand> {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly postsRepository: PostsRepository,
    private readonly commentsRepository: CommentsRepository,
  ) {}

  async execute({ dto }: CreateCommentCommand): Promise<number> {
    const post: PostDb | null = await this.postsRepository.getById(dto.postId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${dto.postId}) does not exist`,
      });
    }

    const commentDomainDto: CreateCommentDomainDto = {
      postId: dto.postId,
      content: dto.content,
      commentatorId: dto.userId,
    };

    return await this.commentsRepository.insertComment(commentDomainDto);
  }
}
