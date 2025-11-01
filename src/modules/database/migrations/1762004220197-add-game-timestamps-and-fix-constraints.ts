import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameTimestampsAndFixConstraints1762004220197 implements MigrationInterface {
  name = 'AddGameTimestampsAndFixConstraints1762004220197';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games" ADD "start_game_date" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "games" ADD "finish_game_date" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "questions" ALTER COLUMN "public_id" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "questions" ALTER COLUMN "public_id" SET DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" DROP CONSTRAINT "FK_4c5351759926b365b1572dbdd1e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" DROP CONSTRAINT "FK_8b122e0afbb8b1a90a9b8c8ab56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" DROP CONSTRAINT "UQ_a9a01e420bf7d52384ddfd30875"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" DROP CONSTRAINT "UQ_7755e7207f95809211fab8f84d2"`,
    );
    await queryRunner.query(`ALTER TABLE "game_questions" ALTER COLUMN "game_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "game_questions" ALTER COLUMN "question_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "FK_d432f3b8472a4579de8a7e69279"`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "FK_9b6988a1162bc9a53305b6c750a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "UQ_1f151e00f4acf64b4141fdace60"`,
    );
    await queryRunner.query(`ALTER TABLE "answers" ALTER COLUMN "player_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "answers" ALTER COLUMN "game_question_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "players" DROP CONSTRAINT "FK_cef52931b331b4ec107a220fb5d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" DROP CONSTRAINT "FK_ba3575d2fbe71fab7155366235e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" DROP CONSTRAINT "UQ_9778dc0dc50fbefa8f8e76ecd74"`,
    );
    await queryRunner.query(`ALTER TABLE "players" ALTER COLUMN "game_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "players" ALTER COLUMN "user_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "game_questions" ADD CONSTRAINT "UQ_a9a01e420bf7d52384ddfd30875" UNIQUE ("game_id", "order")`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" ADD CONSTRAINT "UQ_7755e7207f95809211fab8f84d2" UNIQUE ("game_id", "question_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" ADD CONSTRAINT "UQ_1f151e00f4acf64b4141fdace60" UNIQUE ("player_id", "game_question_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "UQ_9778dc0dc50fbefa8f8e76ecd74" UNIQUE ("user_id", "game_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" ADD CONSTRAINT "FK_4c5351759926b365b1572dbdd1e" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" ADD CONSTRAINT "FK_8b122e0afbb8b1a90a9b8c8ab56" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" ADD CONSTRAINT "FK_d432f3b8472a4579de8a7e69279" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" ADD CONSTRAINT "FK_9b6988a1162bc9a53305b6c750a" FOREIGN KEY ("game_question_id") REFERENCES "game_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "FK_cef52931b331b4ec107a220fb5d" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "FK_ba3575d2fbe71fab7155366235e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "players" DROP CONSTRAINT "FK_ba3575d2fbe71fab7155366235e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" DROP CONSTRAINT "FK_cef52931b331b4ec107a220fb5d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "FK_9b6988a1162bc9a53305b6c750a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "FK_d432f3b8472a4579de8a7e69279"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" DROP CONSTRAINT "FK_8b122e0afbb8b1a90a9b8c8ab56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" DROP CONSTRAINT "FK_4c5351759926b365b1572dbdd1e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" DROP CONSTRAINT "UQ_9778dc0dc50fbefa8f8e76ecd74"`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "UQ_1f151e00f4acf64b4141fdace60"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" DROP CONSTRAINT "UQ_7755e7207f95809211fab8f84d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" DROP CONSTRAINT "UQ_a9a01e420bf7d52384ddfd30875"`,
    );
    await queryRunner.query(`ALTER TABLE "players" ALTER COLUMN "user_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "players" ALTER COLUMN "game_id" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "UQ_9778dc0dc50fbefa8f8e76ecd74" UNIQUE ("game_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "FK_ba3575d2fbe71fab7155366235e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "FK_cef52931b331b4ec107a220fb5d" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "answers" ALTER COLUMN "game_question_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "answers" ALTER COLUMN "player_id" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "answers" ADD CONSTRAINT "UQ_1f151e00f4acf64b4141fdace60" UNIQUE ("player_id", "game_question_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" ADD CONSTRAINT "FK_9b6988a1162bc9a53305b6c750a" FOREIGN KEY ("game_question_id") REFERENCES "game_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" ADD CONSTRAINT "FK_d432f3b8472a4579de8a7e69279" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" ALTER COLUMN "question_id" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "game_questions" ALTER COLUMN "game_id" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "game_questions" ADD CONSTRAINT "UQ_7755e7207f95809211fab8f84d2" UNIQUE ("game_id", "question_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" ADD CONSTRAINT "UQ_a9a01e420bf7d52384ddfd30875" UNIQUE ("order", "game_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" ADD CONSTRAINT "FK_8b122e0afbb8b1a90a9b8c8ab56" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_questions" ADD CONSTRAINT "FK_4c5351759926b365b1572dbdd1e" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "questions" ALTER COLUMN "public_id" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "questions" ALTER COLUMN "public_id" SET DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "finish_game_date"`);
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "start_game_date"`);
  }
}
