export type CommentDbType = {
  id: number;
  postId: number;
  commentatorId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
