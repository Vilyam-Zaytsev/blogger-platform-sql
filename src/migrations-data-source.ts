import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as process from 'node:process';
import { join } from 'path';
import { SnakeNamingStrategy } from './modules/database/config/snake-naming.strategy';
import { loadEnv } from './settings/configuration/configuration';

config({
  path: loadEnv(),
});

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT ? +process.env.POSTGRES_PORT : 5432,
  username: process.env.POSTGRES_USER_NAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATA_BASE,
  synchronize: false,
  logging: true,
  migrations: [join(__dirname, 'modules/database/migrations/*.{ts,js}')],
  entities: ['src/**/*.entity.ts'],
  namingStrategy: new SnakeNamingStrategy(),
});
