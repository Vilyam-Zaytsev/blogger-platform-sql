import { PostsRepository } from '../../infrastructure/posts.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdatePostDto } from '../../dto/update-post.dto';
import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { BlogDbType } from '../../../blogs/types/blog-db.type';
import { PostDbType } from '../../types/post-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class UpdatePostCommand {
  constructor(public readonly dto: UpdatePostDto) {}
}

@CommandHandler(UpdatePostCommand)
export class UpdatePostUseCase implements ICommandHandler<UpdatePostCommand> {
  constructor(
    private readonly blogsRepository: BlogsRepository,
    private readonly postsRepository: PostsRepository,
  ) {}

  async execute({ dto }: UpdatePostCommand): Promise<void> {
    const blog: BlogDbType = await this.blogsRepository.getByIdOrNotFoundFail(
      dto.blogId,
    );
    const post: PostDbType = await this.postsRepository.getByIdOrNotFoundFail(
      dto.postId,
    );

    if (+post.blogId !== blog.id) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The post with the ID (${post.id}) does not belong to the blog with the ID (${blog.id})`,
      });
    }

    return await this.postsRepository.updatePost(dto);
  }
}
