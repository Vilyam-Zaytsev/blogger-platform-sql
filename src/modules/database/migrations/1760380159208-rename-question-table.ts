import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameQuestionTable1760380159208 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE question RENAME TO questions`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE questions RENAME TO question`);
  }
}
