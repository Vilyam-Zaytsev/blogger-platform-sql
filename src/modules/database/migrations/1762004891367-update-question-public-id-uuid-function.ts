import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateQuestionPublicIdUuidFunction1762004891367 implements MigrationInterface {
  name = 'UpdateQuestionPublicIdUuidFunction1762004891367';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "questions" ALTER COLUMN "public_id" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "questions" ALTER COLUMN "public_id" SET DEFAULT gen_random_uuid()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "questions" ALTER COLUMN "public_id" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "questions" ALTER COLUMN "public_id" SET DEFAULT uuid_generate_v4()`,
    );
  }
}
