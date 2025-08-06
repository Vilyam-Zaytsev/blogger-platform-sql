import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreatePostDto } from '../../dto/create-post.dto';
import { PostsRepository } from '../../infrastructure/posts.repository';
import { BlogDbType } from '../../../blogs/types/blog-db.type';
import { CreatePostDomainDto } from '../../domain/dto/create-post.domain.dto';

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
    const blog: BlogDbType = await this.blogsRepository.getByIdOrNotFoundFail(
      dto.blogId,
    );

    const postDomainDto: CreatePostDomainDto = {
      ...dto,
      blogName: blog.name,
    };

    return await this.postsRepository.insertPost(postDomainDto);
  }
}
