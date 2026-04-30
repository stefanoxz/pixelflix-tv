-- Add brand customization to settings
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS site_logo TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#ffffff';

-- Create profiles table (linked to the concept of the 'Who is watching' screen)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    profile_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    stream_type TEXT NOT NULL,
    name TEXT NOT NULL,
    stream_icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles (Public access for this specific use case, matching the Xtream model)
CREATE POLICY "Public profiles access" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public profiles insert" ON public.profiles FOR INSERT WITH CHECK (true);

-- Policies for Favorites
CREATE POLICY "Public favorites access" ON public.favorites FOR SELECT USING (true);
CREATE POLICY "Public favorites insert" ON public.favorites FOR INSERT WITH CHECK (true);
CREATE POLICY "Public favorites delete" ON public.favorites FOR DELETE USING (true);
