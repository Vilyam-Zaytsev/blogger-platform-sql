export type ReactionDbType = {
  status: ReactionStatus;
  userId: number;
  parentId: number;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
};

export enum ReactionStatus {
  None = 'None',
  Like = 'Like',
  Dislike = 'Dislike',
}
