import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { MeViewDto } from '../../../users/api/view-dto/user.view-dto';
import { User } from '../../../users/domain/entities/user.entity';

@Injectable()
export class AuthQueryRepository {
  constructor(private usersRepository: UsersRepository) {}

  async me(id: number): Promise<MeViewDto> {
    const user: User = await this.usersRepository.getByIdOrNotFoundFail(id);

    return MeViewDto.mapToView(user);
  }
}
