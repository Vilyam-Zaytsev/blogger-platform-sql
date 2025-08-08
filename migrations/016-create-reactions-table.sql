CREATE TABLE "PostsReactions" (
    "id" SERIAL PRIMARY KEY,
    "status" "ReactionStatus" NOT NULL DEFAULT 'None',
    "userId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES "Users" ("id") ON DELETE CASCADE,
    CONSTRAINT fk_post FOREIGN KEY ("postId") REFERENCES "Posts" ("id") ON DELETE CASCADE
);