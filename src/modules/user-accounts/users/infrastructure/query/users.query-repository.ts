import { Injectable } from '@nestjs/common';
import { UserViewDto } from '../../api/view-dto/user.view-dto';
import { GetUsersQueryParams } from '../../api/input-dto/get-users-query-params.input-dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class UsersQueryRepository {
  constructor(@InjectRepository(User) private readonly repository: Repository<User>) {}

  async getByIdOrNotFoundFail(id: number): Promise<UserViewDto> {
    const user: User | null = await this.repository.findOneBy({ id });

    if (!user) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${id}) does not exist`,
      });
    }

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

    const pagesCount = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: users.map((user: User): UserViewDto => UserViewDto.mapToView(user)),
    };
  }
}
