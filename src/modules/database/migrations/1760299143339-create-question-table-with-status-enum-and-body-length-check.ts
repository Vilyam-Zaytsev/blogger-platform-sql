import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionTableWithStatusEnumAndBodyLengthCheck1760299143339
  implements MigrationInterface
{
  name = 'CreateQuestionTableWithStatusEnumAndBodyLengthCheck1760299143339';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."question_status_enum" AS ENUM('Draft', 'Published')`,
    );
    await queryRunner.query(`CREATE TABLE "question"
                             (
                                 "id"             SERIAL                             NOT NULL,
                                 "createdAt"      TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                                 "updatedAt"      TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                                 "deletedAt"      TIMESTAMP WITH TIME ZONE,
                                 "body"           character varying(500) COLLATE "C" NOT NULL,
                                 "correctAnswers" character varying array NOT NULL,
                                 "status"         "public"."question_status_enum"    NOT NULL DEFAULT 'Draft',
                                 CONSTRAINT "CHK_body_length" CHECK (char_length(body) >= 10 AND char_length(body) <= 500),
                                 CONSTRAINT "PK_21e5786aa0ea704ae185a79b2d5" PRIMARY KEY ("id")
                             )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "question"`);
    await queryRunner.query(`DROP TYPE "public"."question_status_enum"`);
  }
}
