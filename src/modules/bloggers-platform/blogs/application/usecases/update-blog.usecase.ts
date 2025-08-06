import { BlogsRepository } from '../../infrastructure/blogs.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateBlogDto } from '../../dto/update-blog.dto';

export class UpdateBlogCommand {
  constructor(public readonly dto: UpdateBlogDto) {}
}

@CommandHandler(UpdateBlogCommand)
export class UpdateBlogUseCase implements ICommandHandler<UpdateBlogCommand> {
  constructor(private readonly blogsRepository: BlogsRepository) {}

  async execute({ dto }: UpdateBlogCommand): Promise<void> {
    await this.blogsRepository.getByIdOrNotFoundFail(dto.id);

    return this.blogsRepository.updateBlog(dto);
  }
}
