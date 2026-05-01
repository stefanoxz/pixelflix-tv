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

  toggleFavorite: async (username: string, item: any, type: string) => {
    const streamId = String(item.stream_id || item.series_id || item.id);
    const name = item.name || item.title || 'Sem Nome';
    const icon = item.icon || item.stream_icon || item.cover || '';
    
    // Check if exists
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('username', username)
      .eq('stream_id', streamId)
      .maybeSingle();

    if (existing) {
      await supabase.from('favorites').delete().eq('id', existing.id);
      return false; // Removed
    } else {
      await supabase.from('favorites').insert({
        username,
        stream_id: streamId,
        stream_type: type,
        name: name,
        stream_icon: icon
      });
      return true; // Added
    }
  }
};
