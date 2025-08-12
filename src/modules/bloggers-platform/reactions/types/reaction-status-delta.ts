import { ReactionStatus } from './reaction-db.type';

export type ReactionStatusDelta = {
  currentStatus: ReactionStatus;
  previousStatus: ReactionStatus;
};
