import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PG_POOL } from './constants/database.constants';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class MigrationRunnerService implements OnModuleInit {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.ensureMigrationsTable();

    const applied: string[] = await this.getAppliedMigrations();
    const migrationDir: string = join(process.cwd(), 'migrations');
    const files: string[] = readdirSync(migrationDir)
      .filter((file: string): boolean => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!applied.includes(file)) {
        const sql: string = readFileSync(join(migrationDir, file), 'utf-8');
        console.log(`Running migration: ${file}`);

        const client: PoolClient = await this.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (name) VALUES ($1)',
            [file],
          );
          await client.query('COMMIT');
          console.log(`Applied: ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`Migration failed: ${file}`, error);
        } finally {
          client.release();
        }
      }
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    await this.pool.query(
      `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        "runOn" TIMESTAMP DEFAULT now()
      );
    `,
    );
  }

  private async getAppliedMigrations(): Promise<string[]> {
    const queryResult: QueryResult<{ name: string }> = await this.pool.query<{
      name: string;
    }>('SELECT name FROM schema_migrations');

    return queryResult.rows.map((row: { name: string }): string => row.name);
  }
}
