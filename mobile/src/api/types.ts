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

export type Category = { id: number; name: string };

export type Photo = { id: string; url: string | null };

export type Workout = {
  id: string;
  category: Category;
  description: string | null;
  photos: Photo[];
};

export type EntryStatus = 'workout' | 'rest' | 'sick';

export type DayEntry = {
  id: string;
  date: string; // YYYY-MM-DD, the day the server counted it for
  created_at: string; // ISO; feed pagination cursor
  status: EntryStatus;
  workouts: Workout[];
};

export type Today = {
  date: string;
  entry: DayEntry | null;
  streak: number;
  week_progress: number;
  week_threshold: number;
  days_since_workout: number | null;
  show_rest_hint: boolean;
};

export type UserBrief = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_public: boolean;
};

export type FollowStatus = 'none' | 'pending' | 'accepted';

export type UserSearch = UserBrief & { follow_status: FollowStatus };

export type Stats = {
  streak: number;
  week_progress: number;
  week_threshold: number;
};

export type Profile = UserSearch & {
  can_view: boolean;
  stats: Stats | null;
};

export type SocialEntry = DayEntry & {
  user: UserBrief;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
};

export type FeedItem = SocialEntry & { stats: Stats };

export type Comment = {
  id: string;
  user: UserBrief;
  text: string;
  created_at: string;
};
