import { Injectable } from '@nestjs/common';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { User } from '../../domain/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UsersExternalRepository {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async getByIdOrNotFoundFail(id: number): Promise<User> {
    const user: User | null = await this.users.findOneBy({ id });

    if (!user) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${id}) does not exist`,
      });
    }

    return user;
  }
}
