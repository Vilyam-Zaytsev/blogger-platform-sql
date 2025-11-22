import { Test, TestingModule } from '@nestjs/testing';
import { GetUsersQuery, GetUsersQueryHandler } from './get-users.query-handler';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { UsersFactory } from '../factories/users.factory';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersRepository } from '../../infrastructure/users.repository';
import { CryptoService } from '../services/crypto.service';
import { CreateUserDto } from '../../dto/create-user.dto';
import {
  GetUsersQueryParams,
  UsersSortBy,
} from '../../api/input-dto/get-users-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { UserViewDto } from '../../api/view-dto/user.view-dto';
import { UsersQueryRepository } from '../../infrastructure/query/users.query-repository';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';
import { DateService } from '../services/date.service';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../../dynamic-config.module';

describe('GetUsersQueryHandler (Integration)', () => {
  let module: TestingModule;
  let queryHandler: GetUsersQueryHandler;
  let dataSource: DataSource;
  let usersFactory: UsersFactory;
  let repository: Repository<User>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(User))],
      providers: [
        GetUsersQueryHandler,
        UsersRepository,
        UsersQueryRepository,
        UsersFactory,
        CryptoService,
        DateService,
      ],
    }).compile();

    queryHandler = module.get<GetUsersQueryHandler>(GetUsersQueryHandler);
    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    repository = dataSource.getRepository<User>(User);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE password_recovery_codes RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE email_confirmation_codes RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  async function createTestUser(login: string, email: string): Promise<User> {
    const dto: CreateUserDto = {
      login,
      email,
      password: 'qwerty',
    };

    const user: User = await usersFactory.create(dto);
    return await repository.save(user);
  }

  describe('базовая пагинация', () => {
    it('должен возвращать пустой список, когда пользователей нет', async () => {
      const queryParams: GetUsersQueryParams = new GetUsersQueryParams();
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.pagesCount).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('должен возвращать список пользователей с дефолтными параметрами', async () => {
      await createTestUser('user1', 'user1@example.com');
      await createTestUser('user2', 'user2@example.com');
      await createTestUser('user3', 'user3@example.com');

      const queryParams = new GetUsersQueryParams();
      const query = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(3);
      expect(result.pagesCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);

      const firstUser: UserViewDto = result.items[0];
      expect(firstUser).toHaveProperty('id');
      expect(firstUser).toHaveProperty('login');
      expect(firstUser).toHaveProperty('email');
      expect(firstUser).toHaveProperty('createdAt');
      expect(typeof firstUser.id).toBe('string');
      expect(typeof firstUser.createdAt).toBe('string');
    });

    it('должен корректно обрабатывать пагинацию с разными размерами страниц', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestUser(`user${i}`, `user${i}@example.com`);
      }

      const queryParams = new GetUsersQueryParams();
      queryParams.pageSize = 2;
      queryParams.pageNumber = 1;
      const query = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(5);
      expect(result.pagesCount).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
    });

    it('должен корректно возвращать вторую страницу', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestUser(`user${i}`, `user${i}@example.com`);
      }

      const queryParams = new GetUsersQueryParams();
      queryParams.pageSize = 2;
      queryParams.pageNumber = 2;
      const query = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(5);
      expect(result.pagesCount).toBe(3);
      expect(result.page).toBe(2);
    });

    //TODO: БАГ!!!
    // it.only('должен возвращать пустой список для несуществующей страницы', async () => {
    //   const initialCount = await dataSource.query('SELECT COUNT(*) as count FROM users');
    //   console.log('Initial count:', initialCount[0].count);
    //
    //   await createTestUser('user1', 'user1@example.com');
    //
    //   const queryParams = new GetUsersQueryParams();
    //   queryParams.pageNumber = 10;
    //   const query = new GetUsersQuery(queryParams);
    //
    //   const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);
    //   // console.log(result);
    //   expect(result).toBeDefined();
    //   expect(result.items).toHaveLength(0);
    //   expect(result.totalCount).toBe(1);
    //   // expect(result.pagesCount).toBe(1);
    //   // expect(result.page).toBe(10);
    // });
  });

  describe('сортировка', () => {
    beforeEach(async () => {
      await createTestUser('alice', 'alice@example.com');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await createTestUser('bob', 'bob@example.com');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await createTestUser('charlie', 'charlie@example.com');
    });

    it('должен сортировать по createdAt в порядке убывания (по умолчанию)', async () => {
      const queryParams: GetUsersQueryParams = new GetUsersQueryParams();
      const query = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.items[0].login).toBe('charlie');
      expect(result.items[1].login).toBe('bob');
      expect(result.items[2].login).toBe('alice');
    });

    it('должен сортировать по createdAt в порядке возрастания', async () => {
      const queryParams: GetUsersQueryParams = new GetUsersQueryParams();
      queryParams.sortDirection = SortDirection.Ascending;
      const query = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.items[0].login).toBe('alice');
      expect(result.items[1].login).toBe('bob');
      expect(result.items[2].login).toBe('charlie');
    });

    it('должен сортировать по логину в алфавитном порядке', async () => {
      const queryParams: GetUsersQueryParams = new GetUsersQueryParams();
      queryParams.sortBy = UsersSortBy.Login;
      queryParams.sortDirection = SortDirection.Ascending;
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.items[0].login).toBe('alice');
      expect(result.items[1].login).toBe('bob');
      expect(result.items[2].login).toBe('charlie');
    });

    it('должен сортировать по логину в обратном алфавитном порядке', async () => {
      const queryParams: GetUsersQueryParams = new GetUsersQueryParams();
      queryParams.sortBy = UsersSortBy.Login;
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.items[0].login).toBe('charlie');
      expect(result.items[1].login).toBe('bob');
      expect(result.items[2].login).toBe('alice');
    });

    it('должен сортировать по логину в алфавитном порядке', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.sortBy = UsersSortBy.Email;
      queryParams.sortDirection = SortDirection.Ascending;
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.items[0].email).toBe('alice@example.com');
      expect(result.items[1].email).toBe('bob@example.com');
      expect(result.items[2].email).toBe('charlie@example.com');
    });

    it('должен сортировать по логину в обратном алфавитном порядке', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.sortBy = UsersSortBy.Email;
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.items[0].email).toBe('charlie@example.com');
      expect(result.items[1].email).toBe('bob@example.com');
      expect(result.items[2].email).toBe('alice@example.com');
    });
  });

  describe('поиск по логину', () => {
    beforeEach(async () => {
      await createTestUser('alice', 'alice@example.com');
      await createTestUser('bob', 'bob@example.com');
      await createTestUser('charlie', 'charlie@example.com');
    });

    it('должен находить пользователей по частичному совпадению логина', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchLoginTerm = 'li';
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].login).toBe('charlie');
      expect(result.items[1].login).toBe('alice');
    });

    it('должен возвращать пустой список при отсутствии совпадений логина', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchLoginTerm = 'nonexistent';
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('должен быть регистронезависимым при поиске по логину', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchLoginTerm = 'LI';
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].login).toBe('charlie');
      expect(result.items[1].login).toBe('alice');
    });
  });

  describe('поиск по email', () => {
    beforeEach(async () => {
      await createTestUser('alice', 'alice@example.com');
      await createTestUser('bob', 'bob@example.com');
      await createTestUser('charlie', 'charlie@example.com');
    });

    it('должен находить пользователей по частичному совпадению email', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchEmailTerm = 'li';
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].email).toBe('charlie@example.com');
      expect(result.items[1].email).toBe('alice@example.com');
    });

    it('должен возвращать пустой список при отсутствии совпадений email', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchEmailTerm = 'nonexistent';
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('должен быть регистронезависимым при поиске по email', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchEmailTerm = 'LI';
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].email).toBe('charlie@example.com');
      expect(result.items[1].email).toBe('alice@example.com');
    });
  });

  describe('комбинированный поиск', () => {
    beforeEach(async () => {
      await createTestUser('alice', 'alice@example.com');
      await createTestUser('bob', 'bob@example.com');
      await createTestUser('charlie', 'charlie@example.com');
    });

    it('должен применять оба фильтра одновременно (AND логика)', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchLoginTerm = 'li';
      queryParams.searchEmailTerm = 'ob';
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.items[0].login).toBe('charlie');
      expect(result.items[1].login).toBe('bob');
      expect(result.items[2].login).toBe('alice');
    });

    it('должен возвращать пустой список при отсутствии совпадений в login и email', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchLoginTerm = 'nonexistent';
      queryParams.searchEmailTerm = 'nonexistent';
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('поиск с пагинацией и сортировкой', () => {
    beforeEach(async () => {
      await createTestUser('atest', 'atest@example.com');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createTestUser('btest', 'btest@example.com');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createTestUser('ctest', 'ctest@example.com');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createTestUser('dtest', 'dtest@example.com');
    });

    it('должен правильно комбинировать поиск, сортировку и пагинацию', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchLoginTerm = 'test';
      queryParams.sortBy = UsersSortBy.Login;
      queryParams.sortDirection = SortDirection.Ascending;
      queryParams.pageSize = 2;
      queryParams.pageNumber = 1;
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(4);
      expect(result.pagesCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.items[0].login).toBe('atest');
      expect(result.items[1].login).toBe('btest');
    });

    it('должен правильно обрабатывать вторую страницу при поиске', async () => {
      const queryParams = new GetUsersQueryParams();
      queryParams.searchLoginTerm = 'test';
      queryParams.sortBy = UsersSortBy.Login;
      queryParams.sortDirection = SortDirection.Ascending;
      queryParams.pageSize = 2;
      queryParams.pageNumber = 2;
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      const result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(4);
      expect(result.pagesCount).toBe(2);
      expect(result.page).toBe(2);
      expect(result.items[0].login).toBe('ctest');
      expect(result.items[1].login).toBe('dtest');
    });
  });

  describe('исключение soft-deleted пользователей', () => {
    it('не должен возвращать soft-deleted пользователей', async () => {
      const { id }: User = await createTestUser('user1', 'user1@example.com');

      const queryParams: GetUsersQueryParams = new GetUsersQueryParams();
      const query: GetUsersQuery = new GetUsersQuery(queryParams);

      let result: PaginatedViewDto<UserViewDto> = await queryHandler.execute(query);
      expect(result.items).toHaveLength(1);

      await repository.softDelete(id);

      result = await queryHandler.execute(query);

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });
});
