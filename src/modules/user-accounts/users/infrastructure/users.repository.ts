import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { PasswordRecoveryDbType } from '../../auth/types/password-recovery-db.type';
import { UpdatePassword } from '../../auth/aplication/types/update-password.type';
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

  async getByConfirmationCode(confirmationCode: string): Promise<User | null> {
    return await this.users.findOne({
      relations: {
        emailConfirmationCode: true,
      },
      where: { emailConfirmationCode: { confirmationCode } },
    });
  }

  async updatePassword(dto: UpdatePassword): Promise<void> {
    const { userId, newPasswordHash } = dto;

    await this.pool.query(
      `UPDATE "Users"
       SET "passwordHash" = $1
       WHERE "id" = $2`,
      [newPasswordHash, userId],
    );
  }

  async getPasswordRecoveryByRecoveryCode(code: string): Promise<PasswordRecoveryDbType | null> {
    const queryResult: QueryResult<PasswordRecoveryDbType> =
      await this.pool.query<PasswordRecoveryDbType>(
        `SELECT *
         FROM "PasswordRecovery"
         WHERE "recoveryCode" = $1`,
        [code],
      );

    if (queryResult.rowCount === 0) {
      return null;
    }

    return queryResult.rows[0];
  }
}
