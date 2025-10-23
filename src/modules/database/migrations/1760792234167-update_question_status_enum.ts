import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateQuestionStatusEnum1760792234167 implements MigrationInterface {
  name = 'UpdateQuestionStatusEnum1760792234167';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."questions_status_enum" RENAME TO "questions_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."questions_status_enum" AS ENUM('notPublished', 'published')`,
    );
    await queryRunner.query(`ALTER TABLE "questions"
      ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "questions" ALTER COLUMN "status" TYPE "public"."questions_status_enum" USING "status"::"text"::"public"."questions_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "questions"
      ALTER COLUMN "status" SET DEFAULT 'notPublished'`);
    await queryRunner.query(`DROP TYPE "public"."questions_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."questions_status_enum_old" AS ENUM('Draft', 'Published')`,
    );
    await queryRunner.query(`ALTER TABLE "questions"
      ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "questions" ALTER COLUMN "status" TYPE "public"."questions_status_enum_old" USING "status"::"text"::"public"."questions_status_enum_old"`,
    );
    await queryRunner.query(`ALTER TABLE "questions"
      ALTER COLUMN "status" SET DEFAULT 'Draft'`);
    await queryRunner.query(`DROP TYPE "public"."questions_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."questions_status_enum_old" RENAME TO "questions_status_enum"`,
    );
  }
}
