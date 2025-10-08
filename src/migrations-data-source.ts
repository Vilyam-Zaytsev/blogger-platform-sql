import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { envFilePaths } from './env-file-paths';
import * as process from 'node:process';
import { join } from 'path';

config({
  path: envFilePaths,
});

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT ? +process.env.POSTGRES_PORT : 5432,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB_NAME,
  synchronize: false,
  logging: true,
  migrations: [join(__dirname, 'modules/database/migrations/*.{ts,js}')],
  entities: ['src/**/*.entity.ts'],
});
