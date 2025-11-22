import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1763836997358 implements MigrationInterface {
  name = 'AddIndexes1763836997358';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX idx_answers_game_id ON answers(game_id);`);
    await queryRunner.query(`CREATE INDEX idx_comments_post_id ON comments(post_id);`);
    await queryRunner.query(`CREATE INDEX idx_comments_user_id ON comments(user_id);`);
    await queryRunner.query(`CREATE INDEX idx_reactions_user_id ON reactions(user_id);`);
    await queryRunner.query(
      `CREATE INDEX idx_reactions_posts_post_id ON reactions_posts(post_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_reactions_comments_comment_id ON reactions_comments(comment_id);`,
    );
    await queryRunner.query(`CREATE INDEX idx_posts_blog_id ON posts(blog_id);`);
    await queryRunner.query(
      `CREATE INDEX idx_posts_blog_id_created_at ON posts(blog_id, created_at DESC);`,
    );
    await queryRunner.query(`CREATE INDEX idx_players_game_id ON players(game_id);`);
    await queryRunner.query(
      `CREATE INDEX idx_game_questions_question_id ON game_questions(question_id);`,
    );
    await queryRunner.query(`CREATE INDEX idx_sessions_user_id ON sessions(user_id);`);
    await queryRunner.query(
      `CREATE INDEX idx_email_confirmation_codes_user_id ON email_confirmation_codes("userId");`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_password_recovery_codes_user_id ON password_recovery_codes("userId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_password_recovery_codes_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_email_confirmation_codes_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sessions_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_game_questions_question_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_players_game_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_blog_id_created_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_blog_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reactions_comments_comment_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reactions_posts_post_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reactions_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_comments_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_comments_post_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_answers_game_id;`);
  }
}
