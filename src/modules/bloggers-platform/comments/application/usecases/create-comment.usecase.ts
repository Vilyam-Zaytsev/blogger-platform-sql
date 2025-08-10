import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../../posts/infrastructure/posts.repository';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { CreateCommentDto } from '../../dto/create-comment.dto';
import { Inject } from '@nestjs/common';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool } from 'pg';
import { UserDbType } from '../../../../user-accounts/users/types/user-db.type';
import { UsersExternalRepository } from '../../../../user-accounts/users/infrastructure/external/users.external-repository';
import { CreateCommentDomainDto } from '../../domain/dto/create-comment.domain-dto';

export class CreateCommentCommand {
  constructor(public readonly dto: CreateCommentDto) {}
}

@CommandHandler(CreateCommentCommand)
export class CreateCommentUseCase
  implements ICommandHandler<CreateCommentCommand>
{
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly postsRepository: PostsRepository,
    private readonly usersExternalRepository: UsersExternalRepository,
    private readonly commentsRepository: CommentsRepository,
  ) {}

  async execute({ dto }: CreateCommentCommand): Promise<number> {
    await this.postsRepository.getByIdOrNotFoundFail(dto.postId);
    const user: UserDbType =
      await this.usersExternalRepository.getByIdOrNotFoundFail(dto.userId);

    const commentDomainDto: CreateCommentDomainDto = {
      postId: dto.postId,
      content: dto.content,
      commentatorId: dto.userId,
      commentatorLogin: user.login,
    };

    return await this.commentsRepository.insertComment(commentDomainDto);
  }
}
