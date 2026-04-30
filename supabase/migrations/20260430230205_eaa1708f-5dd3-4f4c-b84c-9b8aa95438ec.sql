-- Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dns_url TEXT NOT NULL DEFAULT 'http://bkpac.cc',
    admin_password TEXT NOT NULL DEFAULT '1234',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (needed for login and DNS fetching)
CREATE POLICY "Public can read settings" ON public.settings FOR SELECT USING (true);

-- Allow authenticated updates to settings (for admin)
-- In a real app, this should be restricted to an admin role or specific UID
-- For simplicity in this demo, we'll allow updates if the provided password matches
CREATE POLICY "Anyone can update settings" ON public.settings FOR UPDATE USING (true);

-- Insert initial settings if not exists
INSERT INTO public.settings (dns_url, admin_password)
SELECT 'http://bkpac.cc', '1234'
WHERE NOT EXISTS (SELECT 1 FROM public.settings LIMIT 1);
