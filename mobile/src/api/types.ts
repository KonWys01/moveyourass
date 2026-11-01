export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_public: boolean;
  timezone: string;
  streak_threshold: number;
  is_admin: boolean;
};

export type TokenResponse = {
  access_token: string;
  is_new_user: boolean;
  user: User;
};
