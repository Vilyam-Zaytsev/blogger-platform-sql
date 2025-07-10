CREATE TYPE "ConfirmationStatus" AS ENUM ('Confirmed', 'Not confirmed')

CREATE TABLE "EmailConfirmation" (
    "userId" INTEGER PRIMARY KEY REFERENCES "Users"(id) ON DELETE CASCADE,

    "confirmationCode" VARCHAR(255),
    "expirationDate" TIMESTAMPTZ,
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'Not confirmed'
)