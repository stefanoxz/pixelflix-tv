export interface IptvCredentials {
  server: string;
  username: string;
  password: string;
}

export interface Category {
  category_id: string;
  category_name: string;
}

export interface Stream {
  stream_id: number;
  name: string;
  stream_icon: string;
  category_id: string;
  stream_type: 'live' | 'movie' | 'series';
  direct_source?: string;
}
