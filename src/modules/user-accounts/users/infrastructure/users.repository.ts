import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool } from 'pg';

@Injectable()
export class UsersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // async getByIdOrNotFoundFail(id: string): Promise<UserDocument> {
  //   const user: UserDocument | null = await this.UserModel.findOne({
  //     _id: id,
  //     deletedAt: null,
  //   });
  //
  //   if (!user) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.NotFound,
  //       message: `The user with ID (${id}) does not exist`,
  //     });
  //   }
  //
  //   return user;xxxxxxxxxxxxxxxxxxxxxxxx
  // }
  //
  // async getByConfirmationCode(
  //   confirmationCode: string,
  // ): Promise<UserDocument | null> {
  //   return this.UserModel.findOne({
  //     'emailConfirmation.confirmationCode': confirmationCode,
  //     deletedAt: null,
  //   });
  // }
  //
  // async getByRecoveryCode(recoveryCode: string): Promise<UserDocument | null> {
  //   return this.UserModel.findOne({
  //     'passwordRecovery.recoveryCode': recoveryCode,
  //     deletedAt: null,
  //   });
  // }
  //
  async getByLogin(login: string): Promise<UserDbType | null> {
    const result = await this.pool.query(
      `SELECT *
       FROM "Users"
       WHERE login = $1
         AND "deletedAt" IS NULL`,
      [login],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0] as UserDbType;
  }

  async getByEmail(email: string): Promise<UserDbType | null> {
    const result = await this.pool.query(
      `SELECT *
       FROM "Users"
       WHERE email = $1
         AND "deletedAt" IS NULL`,
      [email],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0] as UserDbType;
  }

  // async getByIds(ids: string[]): Promise<UserDocument[]> {
  //   return this.UserModel.find({ _id: { $in: ids } });
  // }
}
