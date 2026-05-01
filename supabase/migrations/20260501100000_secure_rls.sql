-- Fix RLS Policies for Profiles and Favorites by enforcing Supabase Auth Bridge

-- 1. Drop existing unsafe policies
DROP POLICY IF EXISTS "Public profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles insert" ON public.profiles;
DROP POLICY IF EXISTS "Public favorites access" ON public.favorites;
DROP POLICY IF EXISTS "Public favorites insert" ON public.favorites;
DROP POLICY IF EXISTS "Public favorites delete" ON public.favorites;

-- 2. Create SECURE policies using the authenticated user's derived email
-- The frontend now bridges Xtream Auth -> Supabase Auth (email: username@pixelflix.local)
-- We map the stored username to the authenticated email prefix securely.

-- Profiles Policies
CREATE POLICY "Secure profiles select" ON public.profiles 
FOR SELECT USING (
  auth.role() = 'authenticated' AND 
  regexp_replace(lower(username), '[^a-z0-9]', '', 'g') = split_part(auth.jwt()->>'email', '@', 1)
);

CREATE POLICY "Secure profiles insert" ON public.profiles 
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  regexp_replace(lower(username), '[^a-z0-9]', '', 'g') = split_part(auth.jwt()->>'email', '@', 1)
);

CREATE POLICY "Secure profiles update" ON public.profiles 
FOR UPDATE USING (
  auth.role() = 'authenticated' AND 
  regexp_replace(lower(username), '[^a-z0-9]', '', 'g') = split_part(auth.jwt()->>'email', '@', 1)
);

CREATE POLICY "Secure profiles delete" ON public.profiles 
FOR DELETE USING (
  auth.role() = 'authenticated' AND 
  regexp_replace(lower(username), '[^a-z0-9]', '', 'g') = split_part(auth.jwt()->>'email', '@', 1)
);

-- Favorites Policies
CREATE POLICY "Secure favorites select" ON public.favorites 
FOR SELECT USING (
  auth.role() = 'authenticated' AND 
  regexp_replace(lower(username), '[^a-z0-9]', '', 'g') = split_part(auth.jwt()->>'email', '@', 1)
);

CREATE POLICY "Secure favorites insert" ON public.favorites 
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  regexp_replace(lower(username), '[^a-z0-9]', '', 'g') = split_part(auth.jwt()->>'email', '@', 1)
);

CREATE POLICY "Secure favorites delete" ON public.favorites 
FOR DELETE USING (
  auth.role() = 'authenticated' AND 
  regexp_replace(lower(username), '[^a-z0-9]', '', 'g') = split_part(auth.jwt()->>'email', '@', 1)
);
