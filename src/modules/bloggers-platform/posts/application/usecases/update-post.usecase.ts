import { PostsRepository } from '../../infrastructure/posts.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostUpdateDto } from '../dto/post.update-dto';
import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Blog } from '../../../blogs/domain/entities/blog.entity';
import { Post } from '../../domain/entities/post.entity';

export class UpdatePostCommand {
  constructor(public readonly dto: PostUpdateDto) {}
}

@CommandHandler(UpdatePostCommand)
export class UpdatePostUseCase implements ICommandHandler<UpdatePostCommand> {
  constructor(
    private readonly blogsRepository: BlogsRepository,
    private readonly postsRepository: PostsRepository,
  ) {}

  async execute({ dto }: UpdatePostCommand): Promise<void> {
    const blog: Blog | null = await this.blogsRepository.getById(dto.blogId);

    if (!blog) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${dto.blogId}) does not exist`,
      });
    }

    const post: Post | null = await this.postsRepository.getById(dto.postId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${dto.blogId}) does not exist`,
      });
    }

    if (+post.blogId !== blog.id) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The post with the ID (${post.id}) does not belong to the blog with the ID (${blog.id})`,
      });
    }

    await this.postsRepository.update(dto);
  }
}
