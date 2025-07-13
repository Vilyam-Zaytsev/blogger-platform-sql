ALTER TABLE "EmailConfirmation"
DROP CONSTRAINT "EmailConfirmation_userId_fkey";

ALTER TABLE "EmailConfirmation"
ADD CONSTRAINT "EmailConfirmation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "Users"(id);

ALTER TABLE "EmailConfirmation"
ADD COLUMN "deletedAt" TIMESTAMPTZ;