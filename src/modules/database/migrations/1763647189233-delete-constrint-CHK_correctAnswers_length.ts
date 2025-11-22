import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeleteConstrintCHKCorrectAnswersLength1763647189233 implements MigrationInterface {
  name = 'DeleteConstrintCHKCorrectAnswersLength1763647189233';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "questions" DROP CONSTRAINT "CHK_correctAnswers_length"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "questions" ADD CONSTRAINT "CHK_correctAnswers_length" CHECK (check_varchar_array_length(correct_answers, 1, 100))`,
    );
  }
}
