import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, PoolClient, QueryResult } from 'pg';
import { CreateUserDto } from '../dto/create-user.dto';
import {
  ConfirmationStatus,
  EmailConfirmationDbType,
} from '../types/email-confirmation-db.type';
import { UserDbType } from '../types/user-db.type';
import { DomainException } from 'src/core/exceptions/damain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { CreateEmailConfirmationDto } from '../../auth/dto/create-email-confirmation.dto';

@Injectable()
export class UsersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertUser(dto: CreateUserDto): Promise<UserDbType> {
    const query: string = `
        INSERT INTO "Users" ("login", "email", "passwordHash")
        VALUES ($1, $2, $3) RETURNING *;
    `;

    const values: string[] = [dto.login, dto.email, dto.passwordHash];

    const queryResult: QueryResult<UserDbType> =
      await this.pool.query<UserDbType>(query, values);

    return queryResult.rows[0];
  }

  async insertEmailConfirmationWithConfirmedStatus(
    userId: number,
  ): Promise<void> {
    const query: string = `
        INSERT INTO "EmailConfirmation" ("userId",
                                         "confirmationCode",
                                         "expirationDate",
                                         "confirmationStatus")
        VALUES ($1, NULL, NULL, $2)
    `;

    const values = [userId, ConfirmationStatus.Confirmed];

    await this.pool.query(query, values);
  }

  async insertEmailConfirmationWithNotConfirmedStatus(
    dto: CreateEmailConfirmationDto,
  ): Promise<EmailConfirmationDbType> {
    const { userId, confirmationCode, expirationDate, confirmationStatus } =
      dto;
    const query: string = `
        INSERT INTO "EmailConfirmation" ("userId",
                                         "confirmationCode",
                                         "expirationDate",
                                         "confirmationStatus")
        VALUES ($1, $2, $3, $4)
    `;

    const values = [
      userId,
      confirmationCode,
      expirationDate,
      confirmationStatus,
    ];

    const resultQuery: QueryResult<EmailConfirmationDbType> =
      await this.pool.query<EmailConfirmationDbType>(query, values);

    return resultQuery.rows[0];
  }

  async getByIdOrNotFoundFail(id: number): Promise<UserDbType> {
    const queryResult: QueryResult<UserDbType> =
      await this.pool.query<UserDbType>(
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
    const queryResult: QueryResult<UserDbType> =
      await this.pool.query<UserDbType>(
        `SELECT *
       FROM "Users"
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
    const queryResult: QueryResult<UserDbType> =
      await this.pool.query<UserDbType>(
        `SELECT *
       FROM "Users"
       WHERE email = $1
         AND "deletedAt" IS NULL`,
        [email],
      );

    if (queryResult.rowCount === 0) {
      return null;
    }

    return queryResult.rows[0];
  }

  //TODO: Нормально ли в этой ситуации то, что репозиторий отвечает за логику приложения?

  //TODO: Нормально ли в этом случае использовать транзакцию или лучше разделить на два метода?

  async softDelete(id: number): Promise<UserDbType | null> {
    const client: PoolClient = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const userResult: QueryResult<UserDbType> =
        await client.query<UserDbType>(
          `UPDATE "Users"
         SET "deletedAt" = NOW()
         WHERE id = $1
           AND "deletedAt" IS NULL RETURNING *;`,
          [id],
        );

      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        throw new DomainException({
          code: DomainExceptionCode.NotFound,
          message: 'The user with ID (${id}) does not exist',
        });
      }

      const user: UserDbType = userResult.rows[0];

      const emailConfirmationResult: QueryResult<EmailConfirmationDbType> =
        await client.query(
          `UPDATE "EmailConfirmation"
           SET "deletedAt" = NOW()
           WHERE "userId" = $1
             AND "deletedAt" IS NULL;`,
          [id],
        );

      if (emailConfirmationResult.rowCount === 0) {
        await client.query('ROLLBACK');
        throw new DomainException({
          code: DomainExceptionCode.InternalServerError,
          message:
            'The user was not deleted because the associated EmailConfirmation was not found',
        });
      }

      await client.query('COMMIT');
      return user;
    } catch (error) {
      console.error(
        'Ошибка при выполнении SQL-запроса в UsersRepository.softDelete():',
        error,
      );

      if (error instanceof DomainException) {
        throw error;
      }

      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: "Couldn't delete user",
      });
    } finally {
      client.release();
    }
  }
}
