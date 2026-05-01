export interface RowItem {
  id: string;
  title: string;
  poster: string;
  badge?: string;
  badgeColor?: string;
  rating?: string;
  year?: string;
  genre?: string;
}

export interface Profile {
  id: string;
  profile_name: string;
  avatar_url: string;
}

export interface StreamSettings {
  dns_url: string;
  username?: string;
  password?: string;
}
