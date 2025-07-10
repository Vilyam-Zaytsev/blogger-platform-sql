import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PG_POOL } from './constants/database.constants';
import { Pool } from 'pg';

@Injectable()
export class MigrationRunnerService implements OnModuleInit {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.ensureMigrationsTable();

    const applied = await this.getAppliedMigrations();
    const migrationDir = join(__dirname, 'migrations');
    const files = readdirSync(migrationDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!applied.includes(file)) {
        const sql = readFileSync(join(migrationDir, file), 'utf-8');
        console.log(`Running migration: ${file}`);
        await this.pool.query(sql);
        await this.pool.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file],
        );
        console.log(`Applied: ${file}`);
      }
    }
  }

  private async ensureMigrationsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        "runOn" TIMESTAMP DEFAULT now()
      );
    `);
  }

  private async getAppliedMigrations(): Promise<string[]> {
    const res = await this.pool.query<{ name: string }>(
      'SELECT name FROM schema_migrations',
    );

    return res.rows.map((row) => row.name);
  }
}
