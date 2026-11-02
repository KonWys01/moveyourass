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
