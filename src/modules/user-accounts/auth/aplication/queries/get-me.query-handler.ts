import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { MeViewDto } from 'src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { AuthQueryRepository } from '../../infrastructure/query/auth.query-repository';

export class GetMeQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetMeQuery)
export class GetMeQueryHandler implements IQueryHandler<GetMeQuery, MeViewDto> {
  constructor(private readonly authQueryRepository: AuthQueryRepository) {}

  async execute({ userId }: GetMeQuery): Promise<MeViewDto> {
    return this.authQueryRepository.me(userId);
  }
}
