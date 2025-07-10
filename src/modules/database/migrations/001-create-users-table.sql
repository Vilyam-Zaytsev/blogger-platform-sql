CREATE TABLE "Users" (
    id SERIAL PRIMARY KEY,

    login VARCHAR(10) NOT NULL UNIQUE CHECK (LENGTH(login) >= 3 AND login ~ '^[a-zA-Z0-9_-]*$'),
    email VARCHAR(255) NOT NULL UNIQUE CHECK (email ~ '^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$'),
    "passwordHash" VARCHAR(255) NOT NULL,

    "createdAT" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    "updatedAT" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    "deletedAT" TIMESTAMPTZ
)