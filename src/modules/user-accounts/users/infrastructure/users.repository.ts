import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool } from 'pg';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersRepository {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async save(user: User): Promise<number> {
    const { id }: User = await this.users.save(user);

    return id;
  }

  async softDelete(id: number): Promise<void> {
    await this.users.softDelete(id);
  }

  async getByIdOrNotFoundFail(id: number): Promise<User> {
    const user: User | null = await this.users.findOneBy({ id: id });

    if (!user) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${id}) does not exist`,
      });
    }

    return user;
  }

  async getByLogin(login: string): Promise<User | null> {
    return await this.users.findOneBy({ login });
  }

  async getByEmail(email: string): Promise<User | null> {
    return await this.users.findOneBy({ email });
  }

  async getByEmailWithEmailConfirmationCode(email: string): Promise<User | null> {
    return await this.users.findOne({
      relations: {
        emailConfirmationCode: true,
      },
      where: { email },
    });
  }

  async getByEmailConfirmationCode(confirmationCode: string): Promise<User | null> {
    return await this.users.findOne({
      relations: {
        emailConfirmationCode: true,
      },
      where: { emailConfirmationCode: { confirmationCode } },
    });
  }

  async getByPasswordRecoveryCode(recoveryCode: string): Promise<User | null> {
    return await this.users.findOne({
      relations: {
        passwordRecoveryCode: true,
      },
      where: { passwordRecoveryCode: { recoveryCode } },
    });
  }
}
