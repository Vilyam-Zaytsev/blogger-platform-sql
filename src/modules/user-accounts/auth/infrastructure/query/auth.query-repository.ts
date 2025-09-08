import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { MeViewDto } from '../../../users/api/view-dto/user.view-dto';
import { User } from '../../../users/domain/entities/user.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class AuthQueryRepository {
  constructor(private readonly usersRepository: UsersRepository) {}

  async me(id: number): Promise<MeViewDto> {
    const user: User | null = await this.usersRepository.getById(id);

    if (!user) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${id}) does not exist`,
      });
    }

    return MeViewDto.mapToView(user);
  }
}
