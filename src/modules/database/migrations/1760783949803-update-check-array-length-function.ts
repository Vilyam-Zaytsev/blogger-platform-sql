import { MigrationInterface, QueryRunner } from 'typeorm';

export class Empty1760783949803 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_varchar_array_length(
        arr varchar[], min_len int, max_len int
      ) RETURNS boolean AS $$
      DECLARE
        element varchar;
      BEGIN
        FOREACH element IN ARRAY arr LOOP
          IF length(element) < min_len OR length(element) > max_len THEN
            RETURN false;
          END IF;
        END LOOP;

        RETURN true;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_varchar_array_length(
        arr varchar[], min_len int, max_len int
      ) RETURNS boolean AS $$
      DECLARE
        element varchar;
      BEGIN
        IF array_length(arr, 1) IS NULL OR array_length(arr, 1) = 0 THEN
          RETURN false;
        END IF;
        FOREACH element IN ARRAY arr LOOP
          IF length(element) < min_len OR length(element) > max_len THEN
            RETURN false;
          END IF;
        END LOOP;
        RETURN true;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
  }
}
