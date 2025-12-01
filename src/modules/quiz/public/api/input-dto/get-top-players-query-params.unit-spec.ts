import 'reflect-metadata';
import { plainToClass } from 'class-transformer';
import {
  GetTopPlayersQueryParams,
  TopPlayersSortField,
} from './get-top-players-query-params.input-dto';
import { validate } from 'class-validator';
import { ValidationError } from '@nestjs/common';

describe('GetTopPlayersQueryParams', () => {
  describe('GetTopPlayersQueryParams - базовые тесты', () => {
    it('должен принять правильный регистр', async () => {
      const input = { sort: 'avgScores desc' };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const errors: ValidationError[] = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('должен отклонить неправильный регистр поля', async () => {
      const input = { sort: 'AvgScores desc' };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const errors: ValidationError[] = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('должен отклонить неправильный регистр направления', async () => {
      const input = { sort: 'avgScores DESC' };
      const dto = plainToClass(GetTopPlayersQueryParams, input);

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('должен преобразовать строку в массив', async () => {
      const input = { sort: 'avgScores desc' };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      expect(dto.sort).toEqual(['avgScores desc']);

      const errors: ValidationError[] = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('должен оставить массив массивом', async () => {
      const input = { sort: ['avgScores desc', 'sumScore asc'] };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      expect(dto.sort).toEqual(['avgScores desc', 'sumScore asc']);

      const errors: ValidationError[] = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('должен использовать дефолтное значение если sort не передан', async () => {
      const input = {};
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      expect(dto.sort).toEqual(['avgScores desc', 'sumScore desc']);

      const errors: ValidationError[] = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('должен корректно распарсить сортировку', () => {
      const input = { sort: ['avgScores desc', 'sumScore asc'] };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const parsed: Array<{ field: string; direction: 'ASC' | 'DESC' }> = dto.getParsedSort();

      expect(parsed).toEqual([
        { field: 'avgScores', direction: 'DESC' },
        { field: 'sumScore', direction: 'ASC' },
      ]);
    });

    it('должен правильно вычислить skip для пагинации', () => {
      const dto1: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, {
        pageNumber: 1,
        pageSize: 10,
      });
      expect(dto1.calculateSkip()).toBe(0);

      const dto2: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, {
        pageNumber: 2,
        pageSize: 10,
      });
      expect(dto2.calculateSkip()).toBe(10);

      const dto3: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, {
        pageNumber: 3,
        pageSize: 5,
      });
      expect(dto3.calculateSkip()).toBe(10);
    });
  });

  describe('Валидация всех полей TopPlayersSortField', () => {
    it.each([
      ['sumScore', TopPlayersSortField.SumScore],
      ['avgScores', TopPlayersSortField.AvgScores],
      ['gamesCount', TopPlayersSortField.GamesCount],
      ['winsCount', TopPlayersSortField.WinsCount],
      ['lossesCount', TopPlayersSortField.LossesCount],
      ['drawsCount', TopPlayersSortField.DrawsCount],
    ])(
      'должен принять поле "%s" с направлением "asc"',
      async (fieldName: string, enumValue: TopPlayersSortField) => {
        const input = { sort: `${enumValue} asc` };
        const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

        const errors: ValidationError[] = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.sort).toEqual([`${enumValue} asc`]);
      },
    );

    it.each([
      ['sumScore', TopPlayersSortField.SumScore],
      ['avgScores', TopPlayersSortField.AvgScores],
      ['gamesCount', TopPlayersSortField.GamesCount],
      ['winsCount', TopPlayersSortField.WinsCount],
      ['lossesCount', TopPlayersSortField.LossesCount],
      ['drawsCount', TopPlayersSortField.DrawsCount],
    ])('должен принять поле "%s" с направлением "desc"', async (fieldName, enumValue) => {
      const input = { sort: `${enumValue} desc` };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const errors: ValidationError[] = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.sort).toEqual([`${enumValue} desc`]);
    });

    it('должен принять все поля одновременно', async () => {
      const allFields: TopPlayersSortField[] = Object.values(TopPlayersSortField);
      const sortParams: string[] = [
        ...allFields.map((field) => `${field} asc`),
        ...allFields.map((field) => `${field} desc`),
      ];

      const input = { sort: sortParams };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const errors: ValidationError[] = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.sort).toEqual(sortParams);
    });

    it('должен корректно распарсить все поля с разными направлениями', () => {
      const input = {
        sort: [
          'sumScore asc',
          'avgScores desc',
          'gamesCount asc',
          'winsCount desc',
          'lossesCount asc',
          'drawsCount desc',
        ],
      };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const parsed: Array<{ field: string; direction: 'ASC' | 'DESC' }> = dto.getParsedSort();

      expect(parsed).toEqual([
        { field: 'sumScore', direction: 'ASC' },
        { field: 'avgScores', direction: 'DESC' },
        { field: 'gamesCount', direction: 'ASC' },
        { field: 'winsCount', direction: 'DESC' },
        { field: 'lossesCount', direction: 'ASC' },
        { field: 'drawsCount', direction: 'DESC' },
      ]);
    });
  });

  describe('Негативные тесты - неправильные поля', () => {
    it.each([
      'invalidField asc',
      'score desc',
      'sum asc',
      'avg desc',
      'games asc',
      'wins desc',
      'losses asc',
      'draws desc',
    ])('должен отклонить несуществующее поле "%s"', async (invalidSort: string) => {
      const input = { sort: invalidSort };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const errors: ValidationError[] = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sort');
      expect(errors[0].constraints).toHaveProperty('matches');
    });
  });

  describe('Негативные тесты - неправильный регистр', () => {
    it.each([
      ['SumScore asc', 'неправильный регистр поля (заглавная)'],
      ['sumScore Asc', 'неправильный регистр направления (заглавная)'],
      ['sumScore ASC', 'неправильный регистр направления (все заглавные)'],
      ['SUMCORE asc', 'неправильный регистр поля (все заглавные)'],
      ['AvgScores desc', 'неправильный регистр поля (заглавная в начале)'],
      ['avgScores DESC', 'неправильный регистр направления (все заглавные)'],
    ])('должен отклонить "%s" (%s)', async (invalidSort: string) => {
      const input = { sort: invalidSort };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const errors: ValidationError[] = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sort');
      expect(errors[0].constraints).toHaveProperty('matches');
    });
  });

  describe('Негативные тесты - неправильное направление', () => {
    it.each([
      'sumScore ascending',
      'avgScores descending',
      'gamesCount up',
      'winsCount down',
      'lossesCount ASC',
      'drawsCount DESC',
    ])('должен отклонить неправильное направление "%s"', async (invalidSort: string) => {
      const input = { sort: invalidSort };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const errors: ValidationError[] = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sort');
    });
  });

  describe('Негативные тесты - неправильный формат', () => {
    it.each([
      ['sumScore', 'нет направления'],
      ['asc', 'нет поля'],
      ['sumScore asc extra', 'лишний текст'],
      ['sumScore  asc', 'двойной пробел'],
      [' sumScore asc', 'пробел в начале'],
      ['sumScore asc ', 'пробел в конце'],
      ['sumScore-asc', 'дефис вместо пробела'],
      ['sumScore_asc', 'подчёркивание вместо пробела'],
    ])('должен отклонить неправильный формат "%s" (%s)', async (invalidSort: string) => {
      const input = { sort: invalidSort };
      const dto: GetTopPlayersQueryParams = plainToClass(GetTopPlayersQueryParams, input);

      const errors: ValidationError[] = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
