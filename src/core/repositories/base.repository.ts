import { Pool, QueryResult, QueryResultRow } from 'pg';

export abstract class BaseRepository<TEntity extends QueryResultRow, TCreateDto, TUpdateDto> {
  protected constructor(
    protected readonly pool: Pool,
    protected readonly tableName: string,
  ) {}

  abstract create(dto: TCreateDto): Promise<number>;

  abstract update(dto: TUpdateDto): Promise<void>;

  async softDelete(id: number): Promise<void> {
    const query = `
      UPDATE "${this.tableName}"
      SET "deletedAt" = NOW()
      WHERE "id" = $1
        AND "deletedAt" IS NULL
    `;

    await this.pool.query(query, [id]);
  }

  async getById(id: number): Promise<TEntity | null> {
    const query = `
      SELECT *
      FROM "${this.tableName}"
      WHERE "id" = $1
        AND "deletedAt" IS NULL
    `;

    const { rows }: QueryResult<TEntity> = await this.pool.query(query, [id]);

    return rows[0] || null;
  }
}
