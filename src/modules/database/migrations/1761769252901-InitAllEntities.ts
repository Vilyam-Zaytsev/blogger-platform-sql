import { MigrationInterface, QueryRunner } from "typeorm";

export class InitAllEntities1761769252901 implements MigrationInterface {
    name = 'InitAllEntities1761769252901'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."email_confirmation_codes_confirmation_status_enum" AS ENUM('Confirmed', 'Not confirmed')`);
        await queryRunner.query(`CREATE TABLE "email_confirmation_codes" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "confirmation_code" character varying(255), "expiration_date" TIMESTAMP WITH TIME ZONE, "confirmation_status" "public"."email_confirmation_codes_confirmation_status_enum" NOT NULL DEFAULT 'Not confirmed', "userId" integer, CONSTRAINT "UQ_12af5b7158c9484e3d8f1b46312" UNIQUE ("confirmation_code"), CONSTRAINT "REL_96d2547f03816d23a2cfaea911" UNIQUE ("userId"), CONSTRAINT "PK_4625ddcbdb342246349422503aa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "password_recovery_codes" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "recovery_code" character varying(255), "expiration_date" TIMESTAMP WITH TIME ZONE, "userId" integer, CONSTRAINT "UQ_67222d1bd41b25d95796b4f81cd" UNIQUE ("recovery_code"), CONSTRAINT "REL_a3a77e1f77749faad3e39b0ba5" UNIQUE ("userId"), CONSTRAINT "PK_25813f45b3266672a186e0c5dbb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "device_id" character varying(255) NOT NULL, "device_name" character varying(255) COLLATE "C" NOT NULL, "ip" character varying(255) COLLATE "C" NOT NULL, "iat" TIMESTAMP WITH TIME ZONE NOT NULL, "exp" TIMESTAMP WITH TIME ZONE NOT NULL, "user_id" integer NOT NULL, CONSTRAINT "UQ_97207844c19e5c27d33a07f67c0" UNIQUE ("device_id"), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "blogs" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying(15) COLLATE "C" NOT NULL, "description" character varying(500) COLLATE "C" NOT NULL, "website_url" character varying(100) COLLATE "C" NOT NULL, "is_membership" boolean NOT NULL DEFAULT false, CONSTRAINT "CHK_website_url_pattern" CHECK ("website_url" ~ '^https:\/\/([a-zA-Z0-9_-]+\.)+[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/?$'), CONSTRAINT "CHK_description_length" CHECK (char_length(description) >= 1 AND char_length(description) <= 500), CONSTRAINT "CHK_name_length" CHECK (char_length(name) >= 1 AND char_length(name) <= 15), CONSTRAINT "PK_e113335f11c926da929a625f118" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reactions_comments" ("reaction_id" integer NOT NULL, "comment_id" integer NOT NULL, "reactionId" integer, "commentId" integer, CONSTRAINT "REL_1f28259dd5b4165f009883259f" UNIQUE ("reactionId"), CONSTRAINT "PK_981dd9e37fac064d8d46c38356f" PRIMARY KEY ("reaction_id"))`);
        await queryRunner.query(`CREATE TABLE "comments" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "content" character varying(300) COLLATE "C" NOT NULL, "user_id" integer NOT NULL, "post_id" integer NOT NULL, CONSTRAINT "CHK_content_length" CHECK (char_length(content) >= 20 AND char_length(content) <= 300), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "posts" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "title" character varying(30) COLLATE "C" NOT NULL, "short_description" character varying(100) COLLATE "C" NOT NULL, "content" character varying(1000) COLLATE "C" NOT NULL, "blog_id" integer NOT NULL, CONSTRAINT "CHK_content_length" CHECK (char_length(content) >= 1 AND char_length(content) <= 1000), CONSTRAINT "CHK_short_direction_length" CHECK (char_length("short_description") >= 1 AND char_length("short_description") <= 100), CONSTRAINT "CHK_title_length" CHECK (char_length(title) >= 1 AND char_length(title) <= 30), CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reactions_posts" ("reaction_id" integer NOT NULL, "post_id" integer NOT NULL, CONSTRAINT "PK_9f8682f82832d3a2480f749eae2" PRIMARY KEY ("reaction_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."reactions_status_enum" AS ENUM('None', 'Like', 'Dislike')`);
        await queryRunner.query(`CREATE TABLE "reactions" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "status" "public"."reactions_status_enum" NOT NULL DEFAULT 'None', "user_id" integer NOT NULL, CONSTRAINT "PK_0b213d460d0c473bc2fb6ee27f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."questions_status_enum" AS ENUM('notPublished', 'published')`);
        await queryRunner.query(`CREATE TABLE "questions" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "public_id" uuid NOT NULL DEFAULT gen_random_uuid(), "body" character varying(500) COLLATE "C" NOT NULL, "correct_answers" character varying array NOT NULL, "status" "public"."questions_status_enum" NOT NULL DEFAULT 'notPublished', CONSTRAINT "UQ_3aa05354b01d6ddf00bfc2f1025" UNIQUE ("public_id"), CONSTRAINT "CHK_body_length" CHECK (char_length(body) >= 10 AND char_length(body) <= 500), CONSTRAINT "CHK_correctAnswers_length" CHECK (check_varchar_array_length("correct_answers", 1, 100)), CONSTRAINT "PK_08a6d4b0f49ff300bf3a0ca60ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "game_questions" ("id" SERIAL NOT NULL, "order" integer NOT NULL, "added_at" TIMESTAMP NOT NULL DEFAULT now(), "game_id" integer, "question_id" integer, CONSTRAINT "UQ_a9a01e420bf7d52384ddfd30875" UNIQUE ("game_id", "order"), CONSTRAINT "UQ_7755e7207f95809211fab8f84d2" UNIQUE ("game_id", "question_id"), CONSTRAINT "PK_8655fa1f9639162ee24c3a5582a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."games_status_enum" AS ENUM('PendingSecondPlayer', 'Active', 'Finished')`);
        await queryRunner.query(`CREATE TABLE "games" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "status" "public"."games_status_enum" NOT NULL DEFAULT 'PendingSecondPlayer', CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."answers_status_enum" AS ENUM('Correct', 'Incorrect')`);
        await queryRunner.query(`CREATE TABLE "answers" ("id" SERIAL NOT NULL, "answer_body" character varying(255) NOT NULL, "status" "public"."answers_status_enum" NOT NULL, "added_at" TIMESTAMP NOT NULL DEFAULT now(), "player_id" integer, "game_question_id" integer, "game_id" integer, CONSTRAINT "UQ_1f151e00f4acf64b4141fdace60" UNIQUE ("player_id", "game_question_id"), CONSTRAINT "PK_9c32cec6c71e06da0254f2226c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."players_role_enum" AS ENUM('Host', 'Player')`);
        await queryRunner.query(`CREATE TABLE "players" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "role" "public"."players_role_enum" NOT NULL DEFAULT 'Player', "score" integer NOT NULL DEFAULT '0', "game_id" integer, "user_id" integer, CONSTRAINT "UQ_9778dc0dc50fbefa8f8e76ecd74" UNIQUE ("user_id", "game_id"), CONSTRAINT "PK_de22b8fdeee0c33ab55ae71da3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "login" character varying(10) COLLATE "C" NOT NULL, "email" character varying(255) COLLATE "C" NOT NULL, "password_hash" character varying(255) NOT NULL, CONSTRAINT "UQ_2d443082eccd5198f95f2a36e2c" UNIQUE ("login"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "CHK_email_pattern" CHECK (email ~ '^[A-Za-z0-9_.-]+@[A-Za-z0-9-]+(\.[A-Za-z]{2,4})+$'), CONSTRAINT "CHK_login_pattern" CHECK (login ~ '^[a-zA-Z0-9_-]*$'), CONSTRAINT "CHK_login_length" CHECK (char_length(login) >= 3 AND char_length(login) <= 10), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "email_confirmation_codes" ADD CONSTRAINT "FK_96d2547f03816d23a2cfaea911e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "password_recovery_codes" ADD CONSTRAINT "FK_a3a77e1f77749faad3e39b0ba57" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reactions_comments" ADD CONSTRAINT "FK_1f28259dd5b4165f009883259f6" FOREIGN KEY ("reactionId") REFERENCES "reactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reactions_comments" ADD CONSTRAINT "FK_45c8b63c5fd2047bf7f56c82694" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_259bf9825d9d198608d1b46b0b5" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_7689491fe4377a8090576a799a0" FOREIGN KEY ("blog_id") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reactions_posts" ADD CONSTRAINT "FK_9f8682f82832d3a2480f749eae2" FOREIGN KEY ("reaction_id") REFERENCES "reactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reactions_posts" ADD CONSTRAINT "FK_fc81abfbea081f0ecb9e3cfeb7b" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reactions" ADD CONSTRAINT "FK_dde6062145a93649adc5af3946e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_questions" ADD CONSTRAINT "FK_4c5351759926b365b1572dbdd1e" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_questions" ADD CONSTRAINT "FK_8b122e0afbb8b1a90a9b8c8ab56" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "answers" ADD CONSTRAINT "FK_d432f3b8472a4579de8a7e69279" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "answers" ADD CONSTRAINT "FK_9b6988a1162bc9a53305b6c750a" FOREIGN KEY ("game_question_id") REFERENCES "game_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "answers" ADD CONSTRAINT "FK_4a7ca78514f533b22331476b8f7" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "players" ADD CONSTRAINT "FK_cef52931b331b4ec107a220fb5d" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "players" ADD CONSTRAINT "FK_ba3575d2fbe71fab7155366235e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "players" DROP CONSTRAINT "FK_ba3575d2fbe71fab7155366235e"`);
        await queryRunner.query(`ALTER TABLE "players" DROP CONSTRAINT "FK_cef52931b331b4ec107a220fb5d"`);
        await queryRunner.query(`ALTER TABLE "answers" DROP CONSTRAINT "FK_4a7ca78514f533b22331476b8f7"`);
        await queryRunner.query(`ALTER TABLE "answers" DROP CONSTRAINT "FK_9b6988a1162bc9a53305b6c750a"`);
        await queryRunner.query(`ALTER TABLE "answers" DROP CONSTRAINT "FK_d432f3b8472a4579de8a7e69279"`);
        await queryRunner.query(`ALTER TABLE "game_questions" DROP CONSTRAINT "FK_8b122e0afbb8b1a90a9b8c8ab56"`);
        await queryRunner.query(`ALTER TABLE "game_questions" DROP CONSTRAINT "FK_4c5351759926b365b1572dbdd1e"`);
        await queryRunner.query(`ALTER TABLE "reactions" DROP CONSTRAINT "FK_dde6062145a93649adc5af3946e"`);
        await queryRunner.query(`ALTER TABLE "reactions_posts" DROP CONSTRAINT "FK_fc81abfbea081f0ecb9e3cfeb7b"`);
        await queryRunner.query(`ALTER TABLE "reactions_posts" DROP CONSTRAINT "FK_9f8682f82832d3a2480f749eae2"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_7689491fe4377a8090576a799a0"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_259bf9825d9d198608d1b46b0b5"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d"`);
        await queryRunner.query(`ALTER TABLE "reactions_comments" DROP CONSTRAINT "FK_45c8b63c5fd2047bf7f56c82694"`);
        await queryRunner.query(`ALTER TABLE "reactions_comments" DROP CONSTRAINT "FK_1f28259dd5b4165f009883259f6"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`);
        await queryRunner.query(`ALTER TABLE "password_recovery_codes" DROP CONSTRAINT "FK_a3a77e1f77749faad3e39b0ba57"`);
        await queryRunner.query(`ALTER TABLE "email_confirmation_codes" DROP CONSTRAINT "FK_96d2547f03816d23a2cfaea911e"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "players"`);
        await queryRunner.query(`DROP TYPE "public"."players_role_enum"`);
        await queryRunner.query(`DROP TABLE "answers"`);
        await queryRunner.query(`DROP TYPE "public"."answers_status_enum"`);
        await queryRunner.query(`DROP TABLE "games"`);
        await queryRunner.query(`DROP TYPE "public"."games_status_enum"`);
        await queryRunner.query(`DROP TABLE "game_questions"`);
        await queryRunner.query(`DROP TABLE "questions"`);
        await queryRunner.query(`DROP TYPE "public"."questions_status_enum"`);
        await queryRunner.query(`DROP TABLE "reactions"`);
        await queryRunner.query(`DROP TYPE "public"."reactions_status_enum"`);
        await queryRunner.query(`DROP TABLE "reactions_posts"`);
        await queryRunner.query(`DROP TABLE "posts"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP TABLE "reactions_comments"`);
        await queryRunner.query(`DROP TABLE "blogs"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP TABLE "password_recovery_codes"`);
        await queryRunner.query(`DROP TABLE "email_confirmation_codes"`);
        await queryRunner.query(`DROP TYPE "public"."email_confirmation_codes_confirmation_status_enum"`);
    }

}
