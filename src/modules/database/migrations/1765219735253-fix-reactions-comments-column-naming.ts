import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixReactionsCommentsColumnNaming1765219735253 implements MigrationInterface {
  name = 'FixReactionsCommentsColumnNaming1765219735253';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" DROP CONSTRAINT "FK_1f28259dd5b4165f009883259f6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" DROP CONSTRAINT "FK_45c8b63c5fd2047bf7f56c82694"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" DROP CONSTRAINT "REL_1f28259dd5b4165f009883259f"`,
    );
    await queryRunner.query(`ALTER TABLE "reactions_comments" DROP COLUMN "reactionId"`);
    await queryRunner.query(`ALTER TABLE "reactions_comments" DROP COLUMN "commentId"`);
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" ADD CONSTRAINT "FK_981dd9e37fac064d8d46c38356f" FOREIGN KEY ("reaction_id") REFERENCES "reactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" ADD CONSTRAINT "FK_96e881ad8fe87769c3c032031e5" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" DROP CONSTRAINT "FK_96e881ad8fe87769c3c032031e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" DROP CONSTRAINT "FK_981dd9e37fac064d8d46c38356f"`,
    );
    await queryRunner.query(`ALTER TABLE "reactions_comments" ADD "commentId" integer`);
    await queryRunner.query(`ALTER TABLE "reactions_comments" ADD "reactionId" integer`);
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" ADD CONSTRAINT "REL_1f28259dd5b4165f009883259f" UNIQUE ("reactionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" ADD CONSTRAINT "FK_45c8b63c5fd2047bf7f56c82694" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" ADD CONSTRAINT "FK_1f28259dd5b4165f009883259f6" FOREIGN KEY ("reactionId") REFERENCES "reactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
