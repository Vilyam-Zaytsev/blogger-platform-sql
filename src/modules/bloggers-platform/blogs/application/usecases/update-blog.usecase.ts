import { BlogsRepository } from '../../infrastructure/blogs.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BlogUpdateDto } from '../../dto/blog.update-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Blog } from '../../domain/entities/blog.entity';

export class UpdateBlogCommand {
  constructor(public readonly dto: BlogUpdateDto) {}
}

@CommandHandler(UpdateBlogCommand)
export class UpdateBlogUseCase implements ICommandHandler<UpdateBlogCommand> {
  constructor(private readonly blogsRepository: BlogsRepository) {}

  async execute({ dto }: UpdateBlogCommand): Promise<void> {
    const blog: Blog | null = await this.blogsRepository.getById(dto.id);

    if (!blog) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${dto.id}) does not exist`,
      });
    }

    blog.update(dto);
    await this.blogsRepository.save(blog);
  }
}
