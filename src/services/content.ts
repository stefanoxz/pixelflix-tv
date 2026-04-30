import { xtreamService } from './xtream';
import { supabase } from './supabase';

export const contentActions = {
  getCategories: async (type: 'live' | 'movie' | 'series') => {
    return xtreamService.getCategories(type);
  },
  
  getStreams: async (type: 'live' | 'movie' | 'series', categoryId?: string) => {
    return xtreamService.getStreams(type, categoryId);
  },

  getFavorites: async (username: string) => {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('username', username);
    if (error) throw error;
    return data;
  },

  toggleFavorite: async (username: string, stream: any, type: string) => {
    const streamId = String(stream.stream_id || stream.series_id);
    
    // Check if exists
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('username', username)
      .eq('stream_id', streamId)
      .single();

    if (existing) {
      await supabase.from('favorites').delete().eq('id', existing.id);
      return false; // Removed
    } else {
      await supabase.from('favorites').insert({
        username,
        stream_id: streamId,
        stream_type: type,
        name: stream.name,
        stream_icon: stream.stream_icon || stream.cover
      });
      return true; // Added
    }
  }
};
