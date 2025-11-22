import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TestingService {
  constructor(private readonly dataSource: DataSource) {}

  async clearAllTablesExceptSchemaMigrations(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`
        DO $$
        DECLARE
          tabnames TEXT;
        BEGIN
          SELECT string_agg(format('"%I"', tablename), ', ')
          INTO tabnames
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename != 'migrations';

          IF tabnames IS NOT NULL THEN
            EXECUTE format('TRUNCATE %s RESTART IDENTITY CASCADE', tabnames);
          END IF;
        END $$;
      `);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
