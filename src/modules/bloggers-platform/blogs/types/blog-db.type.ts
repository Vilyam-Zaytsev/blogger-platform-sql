export type BlogDb = {
  id: number;
  name: string;
  description: string;
  websiteUrl: string;
  isMembership: boolean;
  createdAt: Date;
  updatedAt: string;
  deletedAt: string | null;
};

export type BlogDbWithTotalCount = BlogDb & { totalCount: string };
