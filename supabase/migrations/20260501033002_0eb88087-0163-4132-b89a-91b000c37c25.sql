-- Enable realtime for settings table to allow instant DNS updates
alter publication supabase_realtime add table public.settings;
