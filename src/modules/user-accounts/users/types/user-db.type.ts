export type UserDbType = {
  id: number;
  login: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
