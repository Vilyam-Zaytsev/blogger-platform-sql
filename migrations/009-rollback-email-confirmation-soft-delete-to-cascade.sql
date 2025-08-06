ALTER TABLE "EmailConfirmation"
DROP COLUMN "deletedAt";

ALTER TABLE "EmailConfirmation"
DROP CONSTRAINT "EmailConfirmation_userId_fkey";

ALTER TABLE "EmailConfirmation"
ADD CONSTRAINT "EmailConfirmation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "Users"(id) ON DELETE CASCADE;