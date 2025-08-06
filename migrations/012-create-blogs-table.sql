CREATE TABLE "Blogs" (
    "id" SERIAL PRIMARY KEY,

    "name" VARCHAR(15) COLLATE "C" NOT NULL UNIQUE,
    "description" VARCHAR(500) NOT NULL,
    "websiteUrl" VARCHAR(100) COLLATE "C" NOT NULL UNIQUE
        CHECK("websiteUrl" ~ '^https:\/\/([a-zA-Z0-9_-]+\.)+[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/?$'),

    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMPTZ
)