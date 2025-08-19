CREATE TABLE "CommentsReactions" (
    "id" SERIAL PRIMARY KEY,
    "status" "ReactionStatus" NOT NULL DEFAULT 'None',
    "userId" INTEGER NOT NULL,
    "commentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY ("userId") REFERENCES "Users" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("commentId") REFERENCES "Comments" ("id") ON DELETE CASCADE
);