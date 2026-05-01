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

export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface UserInfo {
  username: string;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface Stream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string | null;
  added: string;
  category_id: string;
  custom_sid: string | null;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
  rating?: string;
  year?: string;
}
