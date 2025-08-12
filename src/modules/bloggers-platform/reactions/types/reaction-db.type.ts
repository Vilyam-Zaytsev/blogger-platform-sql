export type PostReactionDbType = {
  status: ReactionStatus;
  userId: number;
  postId: number;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
};

export enum ReactionStatus {
  None = 'None',
  Like = 'Like',
  Dislike = 'Dislike',
}
