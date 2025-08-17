import { PostsRepository } from '../../infrastructure/posts.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { BlogDb } from '../../../blogs/types/blog-db.type';
import { PostDbType } from '../../types/post-db.type';

export class DeletePostCommand {
  constructor(
    public readonly blogId: number,
    public readonly postId: number,
  ) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostUseCase implements ICommandHandler<DeletePostCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly blogsRepository: BlogsRepository,
  ) {}

  async execute({ blogId, postId }: DeletePostCommand) {
    const blog: BlogDb | null = await this.blogsRepository.getById(blogId);

    if (!blog) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${blogId}) does not exist`,
      });
    }

    const post: PostDbType = await this.postsRepository.getByIdOrNotFoundFail(postId);

    if (+post.blogId !== blog.id) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The post with the ID (${post.id}) does not belong to the blog with the ID (${blog.id})`,
      });
    }

    await this.postsRepository.softDelete(postId);
  }
}
