import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicIdToGames1762013353646 implements MigrationInterface {
  name = 'AddPublicIdToGames1762013353646';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games" ADD "public_id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD CONSTRAINT "UQ_cb977f621d8b1c2b82f049dd59b" UNIQUE ("public_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "UQ_cb977f621d8b1c2b82f049dd59b"`);
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "public_id"`);
  }
}
