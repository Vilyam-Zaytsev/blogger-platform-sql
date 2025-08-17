import { Pool, QueryResult, QueryResultRow } from 'pg';

export abstract class BaseRepository<TEntity extends QueryResultRow, TCreateDto, TUpdateDto> {
  protected constructor(
    protected readonly pool: Pool,
    protected readonly tableName: string,
  ) {}

  abstract create(dto: TCreateDto): Promise<number>;

  abstract update(dto: TUpdateDto): Promise<boolean>;

  async softDelete(id: number): Promise<boolean> {
    const query = `
      UPDATE "${this.tableName}"
      SET "deletedAt" = NOW()
      WHERE "id" = $1
        AND "deletedAt" IS NULL
    `;

    try {
      const { rowCount }: QueryResult = await this.pool.query(query, [id]);

      return rowCount === 1;
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в BaseRepository.softDelete():', error);

      throw error;
    }
  }

  async getById(id: number): Promise<TEntity | null> {
    const query = `
      SELECT *
      FROM "${this.tableName}"
      WHERE "id" = $1
        AND "deletedAt" IS NULL
    `;

    try {
      const { rows }: QueryResult<TEntity> = await this.pool.query(query, [id]);

      return rows[0] || null;
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в BaseRepository.getById():', error);

      throw error;
    }
  }
}
