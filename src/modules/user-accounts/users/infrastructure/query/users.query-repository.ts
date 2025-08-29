import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool } from 'pg';
import { UserViewDto } from '../../api/view-dto/user.view-dto';
import { GetUsersQueryParams } from '../../api/input-dto/get-users-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

@Injectable()
export class UsersQueryRepository {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  async getByIdOrNotFoundFail(id: number): Promise<UserViewDto> {
    const user: User = await this.repository.findOneByOrFail({ id: id });

    return UserViewDto.mapToView(user);
  }

  async getAll(query: GetUsersQueryParams) {
    const {
      sortBy,
      sortDirection,
      pageSize,
      pageNumber,
      searchLoginTerm,
      searchEmailTerm,
    }: GetUsersQueryParams = query;
    const skip: number = query.calculateSkip();
    const whereOptions: FindOptionsWhere<User>[] = [];

    if (searchLoginTerm) whereOptions.push({ login: ILike(`%${searchLoginTerm}%`) });
    if (searchEmailTerm) whereOptions.push({ email: ILike(`%${searchEmailTerm}%`) });

    const [users, totalCount]: [User[], number] = await this.repository.findAndCount({
      select: ['id', 'login', 'email', 'createdAt'],
      where: whereOptions,
      order: {
        [sortBy]: sortDirection,
      },
      take: pageSize,
      skip,
    });

    const items: UserViewDto[] = users.map(
      (user: User): UserViewDto => UserViewDto.mapToView(user),
    );

    return PaginatedViewDto.mapToView<UserViewDto>({
      items,
      totalCount,
      page: pageNumber,
      size: pageSize,
    });
  }
}
