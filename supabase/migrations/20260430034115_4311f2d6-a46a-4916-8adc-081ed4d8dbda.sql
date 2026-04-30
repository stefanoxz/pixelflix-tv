-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow read for everyone (so login page can check if DNS is blocked)
CREATE POLICY "Allow public read access to app_settings"
ON public.app_settings FOR SELECT
USING (true);

-- Allow admins to update settings
CREATE POLICY "Allow admins to manage app_settings"
ON public.app_settings FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Initialize block_new_dns setting if it doesn't exist
INSERT INTO public.app_settings (key, value)
VALUES ('block_new_dns', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Clear all existing DNS servers
DELETE FROM public.allowed_servers;
