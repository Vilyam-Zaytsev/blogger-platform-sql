import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCHKEmailPatternForUser1759934430633 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT "CHK_email_pattern";
      ALTER TABLE "users" ADD CONSTRAINT "CHK_email_pattern" CHECK (email ~ '^[A-Za-z0-9_.-]+@[A-Za-z0-9-]+(\\.[A-Za-z]{2,4})+$');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT "CHK_email_pattern";
      ALTER TABLE "users" ADD CONSTRAINT "CHK_email_pattern" CHECK (email ~ '^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$');
    `);
  }
}
