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

export const getProfiles = async (username: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data;
};

export const createProfile = async (profile: { username: string; profile_name: string; avatar_url: string }) => {
  const { data, error } = await supabase
    .from('profiles')
    .insert([profile])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateProfile = async (id: string, updates: { profile_name?: string; avatar_url?: string }) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteProfile = async (id: string) => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};