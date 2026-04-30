import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getSettings = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();
  
  if (error) {
    console.error('Error fetching settings:', error);
    return { dns_url: 'http://bkpac.cc', admin_password: '1234' };
  }
  return data;
};

export const updateSettings = async (id: string, updates: { dns_url?: string; admin_password?: string; site_logo?: string; primary_color?: string }) => {
  const { data, error } = await supabase
    .from('settings')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data;
};
