import { BlogsRepository } from '../../infrastructure/blogs.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateBlogDto } from '../../dto/update-blog.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class UpdateBlogCommand {
  constructor(public readonly dto: UpdateBlogDto) {}
}

@CommandHandler(UpdateBlogCommand)
export class UpdateBlogUseCase implements ICommandHandler<UpdateBlogCommand> {
  constructor(private readonly blogsRepository: BlogsRepository) {}

  async execute({ dto }: UpdateBlogCommand): Promise<void> {
    //TODO: нормально ли делать проверку на существование блога таким образом(при обновлении) или лучше явно делать SELECT? или объединить эти два варианта?
    const result: boolean = await this.blogsRepository.update(dto);

    if (!result) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${dto.id}) does not exist`,
      });
    }
  }
}
