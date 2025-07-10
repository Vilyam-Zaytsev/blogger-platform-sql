CREATE TABLE "PasswordRecovery" (
    "userId" INTEGER PRIMARY KEY REFERENCES "Users"(id) ON DELETE CASCADE,

    "recoveryCode" VARCHAR(255),
    "expirationDate" TIMESTAMPTZ,
)