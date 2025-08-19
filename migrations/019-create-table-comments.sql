CREATE TABLE "Comments" (
    id SERIAL PRIMARY KEY,

    "postId" INTEGER NOT NULL,
    "commentatorId" INTEGER NOT NULL,

    content VARCHAR(300) COLLATE "C" NOT NULL
         CHECK (LENGTH(content) >= 20),

    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMPTZ,

     FOREIGN KEY ("postId") REFERENCES "Posts"(id) ON DELETE CASCADE,
    FOREIGN KEY ("commentatorId") REFERENCES "Users"(id) ON DELETE CASCADE
);