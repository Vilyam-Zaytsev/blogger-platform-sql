import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/constants/database.constants';

@Controller('testing')
export class TestingController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Delete('all-data')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAll(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query<{ tablename: string }>(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public';
      `);

      const tableNames: string[] = rows
        .map((r): string => r.tablename)
        .filter((name: string): boolean => name !== 'schema_migrations');

      if (tableNames.length > 0) {
        const tablesList: string = tableNames
          .map((name: string): string => `"${name}"`)
          .join(', ');
        await client.query(`TRUNCATE ${tablesList} RESTART IDENTITY CASCADE;`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(
        'Ошибка при удалении всех данных в тестовом модуле:',
        error,
      );
      throw error;
    } finally {
      client.release();
    }
  }
}
