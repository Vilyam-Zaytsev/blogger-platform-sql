import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAnswersAddedatTimezone1763469262957 implements MigrationInterface {
  name = 'AlterAnswersAddedatTimezone1763469262957';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "answers" DROP COLUMN "added_at"`);
    await queryRunner.query(
      `ALTER TABLE "answers" ADD "added_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "answers" DROP COLUMN "added_at"`);
    await queryRunner.query(
      `ALTER TABLE "answers" ADD "added_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }
}
