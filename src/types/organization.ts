export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type MemberRole = 'admin' | 'member';

export type Member = {
  id: string;
  userId: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
};
