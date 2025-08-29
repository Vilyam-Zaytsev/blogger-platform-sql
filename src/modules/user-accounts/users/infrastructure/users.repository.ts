import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { CreateUserDto } from '../dto/create-user.dto';
import { EmailConfirmationDbType } from '../../auth/types/email-confirmation-db.type';
import { UserDbType } from '../types/user-db.type';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import {
  CreateEmailConfirmationDto,
  UpdateEmailConfirmationDto,
} from '../../auth/dto/create-email-confirmation.dto';
import { CreatePasswordRecoveryDto } from '../../auth/dto/create-password-recovery.dto';
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
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  async save(user: User): Promise<number> {
    const { id }: User = await this.repository.save(user);

    return id;
  }

  async softDelete(id: number): Promise<void> {
    await this.repository.softDelete(id);
  }

  async getByIdOrNotFoundFail(id: number): Promise<User> {
    const user: User | null = await this.repository.findOneBy({ id: id });

    if (!user) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${id}) does not exist`,
      });
    }

    return user;
  }

  //TODO: УДАЛИТЬ!!!!
  async insertUser(dto: CreateUserDto): Promise<number> {
    const query: string = `
      INSERT INTO "Users" ("login", "email", "passwordHash")
      VALUES ($1, $2, $3) RETURNING id;
    `;

    const values: string[] = [dto.login, dto.email, 'dto.passwordHash'];

    const queryResult: QueryResult<{ id: number }> = await this.pool.query<{
      id: number;
    }>(query, values);

    return queryResult.rows[0].id;
  }

  //TODO: УДАЛИТЬ!!!
  async getByIdOrNotFoundFail2(id: number): Promise<UserDbType> {
    const queryResult: QueryResult<UserDbType> = await this.pool.query<UserDbType>(
      `SELECT *
         FROM "Users"
         WHERE id = $1
           AND "deletedAt" IS NULL`,
      [id],
    );

    if (!queryResult.rows[0]) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${id}) does not exist`,
      });
    }

    return queryResult.rows[0];
  }

  async getByLogin(login: string): Promise<UserDbType | null> {
    const queryResult: QueryResult<UserDbType> = await this.pool.query<UserDbType>(
      `SELECT *
         FROM users
         WHERE login = $1
           AND "deletedAt" IS NULL`,
      [login],
    );

    if (queryResult.rowCount === 0) {
      return null;
    }

    return queryResult.rows[0];
  }

  async getByEmail(email: string): Promise<UserDbType | null> {
    const queryResult: QueryResult<UserDbType> = await this.pool.query<UserDbType>(
      `SELECT *
         FROM users
         WHERE email = $1
           AND "deletedAt" IS NULL`,
      [email],
    );

    if (queryResult.rowCount === 0) {
      return null;
    }

    return queryResult.rows[0];
  }

  async insertEmailConfirmation(dto: CreateEmailConfirmationDto): Promise<string> {
    const { userId, confirmationCode, expirationDate, confirmationStatus } = dto;
    const query: string = `
      INSERT INTO email_confirmation ("userId",
                                       "confirmationCode",
                                       "expirationDate",
                                       "confirmationStatus")
      VALUES ($1, $2, $3, $4) RETURNING "confirmationCode"
    `;

    const values = [userId, confirmationCode, expirationDate, confirmationStatus];

    const resultQuery: QueryResult<{ confirmationCode: string }> = await this.pool.query<{
      confirmationCode: string;
    }>(query, values);

    return resultQuery.rows[0].confirmationCode;
  }

  async getEmailConfirmationByUserId(id: number): Promise<EmailConfirmationDbType | null> {
    const queryResult: QueryResult<EmailConfirmationDbType> =
      await this.pool.query<EmailConfirmationDbType>(
        `SELECT *
         FROM email_confirmation
         WHERE "userId" = $1`,
        [id],
      );

    if (queryResult.rowCount === 0) {
      return null;
    }

    return queryResult.rows[0];
  }

  async getEmailConfirmationByConfirmationCode(
    confirmationCode: string,
  ): Promise<EmailConfirmationDbType | null> {
    const queryResult: QueryResult<EmailConfirmationDbType> =
      await this.pool.query<EmailConfirmationDbType>(
        `SELECT *
         FROM "EmailConfirmation"
         WHERE "confirmationCode" = $1`,
        [confirmationCode],
      );

    if (queryResult.rowCount === 0) {
      return null;
    }

    return queryResult.rows[0];
  }

  async updateEmailConfirmation(dto: UpdateEmailConfirmationDto): Promise<void> {
    const { userId, confirmationCode, expirationDate, confirmationStatus } = dto;

    await this.pool.query<EmailConfirmationDbType>(
      `UPDATE "EmailConfirmation"
       SET "userId"             = $1,
           "confirmationCode"   = $2,
           "expirationDate"     = $3,
           "confirmationStatus" = $4
       WHERE "userId" = $1`,
      [userId, confirmationCode, expirationDate, confirmationStatus],
    );
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

  //TODO: УДАЛИТЬ!!!
  async softDelete2(id: number): Promise<boolean> {
    const result = await this.repository.softDelete({ id: id });

    return result.affected === 1;
  }

  async insertOrUpdatePasswordRecovery(dto: CreatePasswordRecoveryDto): Promise<void> {
    const { userId, recoveryCode, expirationDate } = dto;
    await this.pool.query(
      `
          INSERT INTO "PasswordRecovery" ("userId",
                                          "recoveryCode",
                                          "expirationDate")
          VALUES ($1, $2, $3) ON CONFLICT("userId") DO
          UPDATE SET "recoveryCode" = $2, "expirationDate" = $3;
        `,
      [userId, recoveryCode, expirationDate],
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
