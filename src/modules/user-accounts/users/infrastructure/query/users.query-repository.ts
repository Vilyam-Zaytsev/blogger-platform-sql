import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { UserViewDto } from '../../api/view-dto/user.view-dto';
import { UserDbType } from '../../types/user-db.type';
import { DomainException } from 'src/core/exceptions/damain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class UsersQueryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(id: number): Promise<UserViewDto> {
    const result: QueryResult<UserDbType> = await this.pool.query(
      `SELECT *
       FROM "Users"
       WHERE id = $1
         AND "deletedAt" IS NULL`,
      [id],
    );

    if (result.rowCount === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'User not found.',
      });
    }

    return UserViewDto.mapToView(result.rows[0]);
  }

  // async getAll(
  //   query: GetUsersQueryParams,
  // ): Promise<PaginatedViewDto<UserViewDto>> {
  //   const filter: FilterQuery<User> = {
  //     deletedAt: null,
  //   };
  //
  //   if (query.searchLoginTerm) {
  //     filter.$or = filter.$or || [];
  //     filter.$or.push({
  //       login: { $regex: query.searchLoginTerm, $options: 'i' },
  //     });
  //   }
  //
  //   if (query.searchEmailTerm) {
  //     filter.$or = filter.$or || [];
  //     filter.$or.push({
  //       email: { $regex: query.searchEmailTerm, $options: 'i' },
  //     });
  //   }
  //
  //   const users: UserDocument[] = await this.UserModel.find(filter)
  //     .sort({ [query.sortBy]: query.sortDirection })
  //     .skip(query.calculateSkip())
  //     .limit(query.pageSize);
  //
  //   const totalCount: number = await this.UserModel.countDocuments(filter);
  //
  //   const items: UserViewDto[] = users.map(
  //     (user: UserDocument): UserViewDto => UserViewDto.mapToView(user),
  //   );
  //
  //   return PaginatedViewDto.mapToView<UserViewDto>({
  //     items,
  //     totalCount,
  //     page: query.pageNumber,
  //     size: query.pageSize,
  //   });
  // }
}
