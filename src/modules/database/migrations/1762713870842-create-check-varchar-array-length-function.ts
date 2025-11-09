import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCheckVarcharArrayLengthFunction1762713870842 implements MigrationInterface {
  name = 'CreateCheckVarcharArrayLengthFunction1762713870842';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем функцию для проверки длины элементов массива varchar
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_varchar_array_length(
        arr varchar[], 
        min_len int, 
        max_len int
      ) RETURNS boolean AS $$
      DECLARE
        element varchar;
      BEGIN
        -- Проверка каждого элемента массива
        FOREACH element IN ARRAY arr LOOP
          IF length(element) < min_len OR length(element) > max_len THEN
            RETURN false;
          END IF;
        END LOOP;
        
        -- Все элементы прошли проверку
        RETURN true;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // Добавляем комментарий к функции для документации
    await queryRunner.query(`
      COMMENT ON FUNCTION check_varchar_array_length(varchar[], int, int) IS 
      'Проверяет, что длина каждого элемента в массиве находится в диапазоне [min_len, max_len]. 
       Возвращает true если все элементы валидны, false в противном случае.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем функцию при откате миграции
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS check_varchar_array_length(varchar[], int, int);
    `);
  }
}
