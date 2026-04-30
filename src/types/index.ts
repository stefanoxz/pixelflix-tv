export interface XtreamCredentials {
  url: string;
  username: string;
  password: string;
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface Stream {
  num: number;
  name: string;
  stream_type: 'live' | 'movie' | 'series';
  stream_id?: string;
  series_id?: string;
  stream_icon?: string;
  cover?: string;
  category_id: string;
  added: string;
  rating?: string;
  year?: string;
  duration?: string;
  synopsis?: string;
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
