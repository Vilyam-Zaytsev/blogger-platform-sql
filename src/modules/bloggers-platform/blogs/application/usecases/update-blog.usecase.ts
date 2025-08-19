import { BlogsRepository } from '../../infrastructure/blogs.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateBlogDto } from '../../dto/update-blog.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { BlogDb } from '../../types/blog-db.type';

export class UpdateBlogCommand {
  constructor(public readonly dto: UpdateBlogDto) {}
}

@CommandHandler(UpdateBlogCommand)
export class UpdateBlogUseCase implements ICommandHandler<UpdateBlogCommand> {
  constructor(private readonly blogsRepository: BlogsRepository) {}

  async execute({ dto }: UpdateBlogCommand): Promise<void> {
    const blog: BlogDb | null = await this.blogsRepository.getById(dto.id);

    if (!blog) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${dto.id}) does not exist`,
      });
    }

    await this.blogsRepository.update(dto);
  }
}
