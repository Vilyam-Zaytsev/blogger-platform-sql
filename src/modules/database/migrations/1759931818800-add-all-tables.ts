import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllTables1759931818800 implements MigrationInterface {
  name = 'AddAllTables1759931818800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."email_confirmation_codes_confirmationstatus_enum" AS ENUM('Confirmed', 'Not confirmed')`,
    );
    await queryRunner.query(`CREATE TABLE "email_confirmation_codes"
                             (
                               "id"                 SERIAL                                                      NOT NULL,
                               "createdAt"          TIMESTAMP WITH TIME ZONE                                    NOT NULL DEFAULT now(),
                               "updatedAt"          TIMESTAMP WITH TIME ZONE                                    NOT NULL DEFAULT now(),
                               "deletedAt"          TIMESTAMP WITH TIME ZONE,
                               "confirmationCode"   character varying(255),
                               "expirationDate"     TIMESTAMP WITH TIME ZONE,
                               "confirmationStatus" "public"."email_confirmation_codes_confirmationstatus_enum" NOT NULL DEFAULT 'Not confirmed',
                               "userId"             integer,
                               CONSTRAINT "UQ_b74eea170aa5a9b1334a83da5a1" UNIQUE ("confirmationCode"),
                               CONSTRAINT "REL_96d2547f03816d23a2cfaea911" UNIQUE ("userId"),
                               CONSTRAINT "PK_4625ddcbdb342246349422503aa" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "password_recovery_codes"
                             (
                               "id"             SERIAL                   NOT NULL,
                               "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                               "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                               "deletedAt"      TIMESTAMP WITH TIME ZONE,
                               "recoveryCode"   character varying(255),
                               "expirationDate" TIMESTAMP WITH TIME ZONE,
                               "userId"         integer,
                               CONSTRAINT "UQ_0978a927fccda16766e64b22e3a" UNIQUE ("recoveryCode"),
                               CONSTRAINT "REL_a3a77e1f77749faad3e39b0ba5" UNIQUE ("userId"),
                               CONSTRAINT "PK_25813f45b3266672a186e0c5dbb" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "sessions"
                             (
                               "id"         SERIAL                             NOT NULL,
                               "createdAt"  TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                               "updatedAt"  TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                               "deletedAt"  TIMESTAMP WITH TIME ZONE,
                               "deviceId"   character varying(255)             NOT NULL,
                               "deviceName" character varying(255) COLLATE "C" NOT NULL,
                               "ip"         character varying(255) COLLATE "C" NOT NULL,
                               "iat"        TIMESTAMP WITH TIME ZONE           NOT NULL,
                               "exp"        TIMESTAMP WITH TIME ZONE           NOT NULL,
                               "userId"     integer                            NOT NULL,
                               CONSTRAINT "UQ_fd11aa87698d5a784713b9de978" UNIQUE ("deviceId"),
                               CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "blogs"
                             (
                               "id"           SERIAL                             NOT NULL,
                               "createdAt"    TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                               "updatedAt"    TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                               "deletedAt"    TIMESTAMP WITH TIME ZONE,
                               "name"         character varying(15) COLLATE "C"  NOT NULL,
                               "description"  character varying(500) COLLATE "C" NOT NULL,
                               "websiteUrl"   character varying(100) COLLATE "C" NOT NULL,
                               "isMembership" boolean                            NOT NULL DEFAULT false,
                               CONSTRAINT "CHK_websiteUrl_pattern" CHECK ("websiteUrl" ~ '^https:\/\/([a-zA-Z0-9_-]+\.)+[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/?$'
                             ) , CONSTRAINT "CHK_description_length" CHECK (char_length(description) >= 1 AND char_length(description) <= 500), CONSTRAINT "CHK_name_length" CHECK (char_length(name) >= 1 AND char_length(name) <= 15), CONSTRAINT "PK_e113335f11c926da929a625f118" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "reactions_comments"
                             (
                               "reactionId" integer NOT NULL,
                               "commentId"  integer NOT NULL,
                               CONSTRAINT "PK_1f28259dd5b4165f009883259f6" PRIMARY KEY ("reactionId")
                             )`);
    await queryRunner.query(`CREATE TABLE "comments"
                             (
                               "id"        SERIAL                             NOT NULL,
                               "createdAt" TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                               "updatedAt" TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                               "deletedAt" TIMESTAMP WITH TIME ZONE,
                               "content"   character varying(300) COLLATE "C" NOT NULL,
                               "userId"    integer                            NOT NULL,
                               "postId"    integer                            NOT NULL,
                               CONSTRAINT "CHK_content_length" CHECK (char_length(content) >= 20 AND char_length(content) <= 300),
                               CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "posts"
                             (
                               "id"               SERIAL                              NOT NULL,
                               "createdAt"        TIMESTAMP WITH TIME ZONE            NOT NULL DEFAULT now(),
                               "updatedAt"        TIMESTAMP WITH TIME ZONE            NOT NULL DEFAULT now(),
                               "deletedAt"        TIMESTAMP WITH TIME ZONE,
                               "title"            character varying(30) COLLATE "C"   NOT NULL,
                               "shortDescription" character varying(100) COLLATE "C"  NOT NULL,
                               "content"          character varying(1000) COLLATE "C" NOT NULL,
                               "blogId"           integer                             NOT NULL,
                               CONSTRAINT "CHK_content_length" CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
                               CONSTRAINT "CHK_short_direction_length" CHECK (char_length("shortDescription") >= 1 AND
                                                                              char_length("shortDescription") <= 100),
                               CONSTRAINT "CHK_title_length" CHECK (char_length(title) >= 1 AND char_length(title) <= 30),
                               CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "reactions_posts"
                             (
                               "reactionId" integer NOT NULL,
                               "postId"     integer NOT NULL,
                               CONSTRAINT "PK_fb2a9cd7f79e880d8317b48c87b" PRIMARY KEY ("reactionId")
                             )`);
    await queryRunner.query(
      `CREATE TYPE "public"."reactions_status_enum" AS ENUM('None', 'Like', 'Dislike')`,
    );
    await queryRunner.query(`CREATE TABLE "reactions"
                             (
                               "id"        SERIAL                           NOT NULL,
                               "createdAt" TIMESTAMP WITH TIME ZONE         NOT NULL DEFAULT now(),
                               "updatedAt" TIMESTAMP WITH TIME ZONE         NOT NULL DEFAULT now(),
                               "deletedAt" TIMESTAMP WITH TIME ZONE,
                               "status"    "public"."reactions_status_enum" NOT NULL DEFAULT 'None',
                               "userId"    integer                          NOT NULL,
                               CONSTRAINT "PK_0b213d460d0c473bc2fb6ee27f3" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "users"
                             (
                               "id"           SERIAL                             NOT NULL,
                               "createdAt"    TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                               "updatedAt"    TIMESTAMP WITH TIME ZONE           NOT NULL DEFAULT now(),
                               "deletedAt"    TIMESTAMP WITH TIME ZONE,
                               "login"        character varying(10) COLLATE "C"  NOT NULL,
                               "email"        character varying(255) COLLATE "C" NOT NULL,
                               "passwordHash" character varying(255)             NOT NULL,
                               CONSTRAINT "UQ_2d443082eccd5198f95f2a36e2c" UNIQUE ("login"),
                               CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                               CONSTRAINT "CHK_email_pattern" CHECK (email ~ '^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$'
                             ) , CONSTRAINT "CHK_login_pattern" CHECK (login ~ '^[a-zA-Z0-9_-]*$'), CONSTRAINT "CHK_login_length" CHECK (char_length(login) >= 3 AND char_length(login) <= 10), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "email_confirmation_codes"
      ADD CONSTRAINT "FK_96d2547f03816d23a2cfaea911e" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "password_recovery_codes"
      ADD CONSTRAINT "FK_a3a77e1f77749faad3e39b0ba57" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "sessions"
      ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reactions_comments"
      ADD CONSTRAINT "FK_1f28259dd5b4165f009883259f6" FOREIGN KEY ("reactionId") REFERENCES "reactions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reactions_comments"
      ADD CONSTRAINT "FK_45c8b63c5fd2047bf7f56c82694" FOREIGN KEY ("commentId") REFERENCES "comments" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "comments"
      ADD CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "comments"
      ADD CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" FOREIGN KEY ("postId") REFERENCES "posts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "posts"
      ADD CONSTRAINT "FK_55d9c167993fed3f375391c8e31" FOREIGN KEY ("blogId") REFERENCES "blogs" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reactions_posts"
      ADD CONSTRAINT "FK_fb2a9cd7f79e880d8317b48c87b" FOREIGN KEY ("reactionId") REFERENCES "reactions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reactions_posts"
      ADD CONSTRAINT "FK_c217bae118e516c63eb4a77d190" FOREIGN KEY ("postId") REFERENCES "posts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reactions"
      ADD CONSTRAINT "FK_f3e1d278edeb2c19a2ddad83f8e" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reactions" DROP CONSTRAINT "FK_f3e1d278edeb2c19a2ddad83f8e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_posts" DROP CONSTRAINT "FK_c217bae118e516c63eb4a77d190"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_posts" DROP CONSTRAINT "FK_fb2a9cd7f79e880d8317b48c87b"`,
    );
    await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_55d9c167993fed3f375391c8e31"`);
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" DROP CONSTRAINT "FK_45c8b63c5fd2047bf7f56c82694"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions_comments" DROP CONSTRAINT "FK_1f28259dd5b4165f009883259f6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_recovery_codes" DROP CONSTRAINT "FK_a3a77e1f77749faad3e39b0ba57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_confirmation_codes" DROP CONSTRAINT "FK_96d2547f03816d23a2cfaea911e"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
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
    await queryRunner.query(
      `DROP TYPE "public"."email_confirmation_codes_confirmationstatus_enum"`,
    );
  }
}
