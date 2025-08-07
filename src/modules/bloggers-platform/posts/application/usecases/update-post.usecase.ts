import { PostsRepository } from '../../infrastructure/posts.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdatePostDto } from '../../dto/update-post.dto';

export class UpdatePostCommand {
  constructor(public readonly dto: UpdatePostDto) {}
}

@CommandHandler(UpdatePostCommand)
export class UpdatePostUseCase implements ICommandHandler<UpdatePostCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}

  async execute({ dto }: UpdatePostCommand): Promise<void> {
    await this.postsRepository.getByIdOrNotFoundFail(dto.postId);

    return await this.postsRepository.updatePost(dto);
  }
}
