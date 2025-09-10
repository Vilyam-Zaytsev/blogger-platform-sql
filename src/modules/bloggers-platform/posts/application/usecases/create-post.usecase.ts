import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreatePostDto } from '../../dto/create-post.dto';
import { PostsRepository } from '../../infrastructure/posts.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Blog } from '../../../blogs/domain/entities/blog.entity';

export class CreatePostCommand {
  constructor(public readonly dto: CreatePostDto) {}
}

@CommandHandler(CreatePostCommand)
export class CreatePostUseCase implements ICommandHandler<CreatePostCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly blogsRepository: BlogsRepository,
  ) {}

  async execute({ dto }: CreatePostCommand): Promise<number> {
    const blog: Blog | null = await this.blogsRepository.getById(dto.blogId);

    if (!blog) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${dto.blogId}) does not exist`,
      });
    }

    return await this.postsRepository.create(dto);
  }
}
