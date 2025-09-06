import { BlogsRepository } from '../../infrastructure/blogs.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BlogInputDto } from '../../api/input-dto/blog-input.dto';
import { Blog } from '../../domain/entities/blog.entity';

export class CreateBlogCommand {
  constructor(public readonly dto: BlogInputDto) {}
}

@CommandHandler(CreateBlogCommand)
export class CreateBlogUseCase implements ICommandHandler<CreateBlogCommand> {
  constructor(private readonly blogsRepository: BlogsRepository) {}

  async execute({ dto }: CreateBlogCommand): Promise<number> {
    const blog: Blog = Blog.create(dto);

    return await this.blogsRepository.save(blog);
  }
}
