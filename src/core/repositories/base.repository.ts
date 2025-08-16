import { Pool, QueryResult } from 'pg';

export abstract class BaseRepository<TEntity, TCreateDto, TUpdateDto> {
  constructor(
    protected readonly pool: Pool,
    protected readonly tableName: string,
  ) {}

  abstract create(dto: TCreateDto): Promise<number>;

  abstract update(dto: TUpdateDto): Promise<boolean>;

  abstract getByIdOrNotFoundFail(id: number): Promise<TEntity>;

  async softDelete(id: number): Promise<boolean> {
    const query = `
        UPDATE "${this.tableName}"
        SET "deletedAt" = NOW()
        WHERE "id" = $1
          AND "deletedAt" IS NULL
    `;

    const { rowCount }: QueryResult = await this.pool.query(query, [id]);

    return rowCount === 1;
  }
}
