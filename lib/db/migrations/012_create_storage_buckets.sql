-- Migration 012: Create storage buckets for admin assets
-- This migration creates the admin-assets bucket for storing uploaded images
-- Works for both local Supabase (Docker) and production

-- Create admin-assets bucket for uploaded book covers and event posters
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-assets',
  'admin-assets',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create public read policy (allows anyone to view uploaded images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Public Access for admin-assets'
  ) THEN
    CREATE POLICY "Public Access for admin-assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'admin-assets');
  END IF;
END $$;

-- Create service role write policy (allows server-side uploads via service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Service role can upload to admin-assets'
  ) THEN
    CREATE POLICY "Service role can upload to admin-assets"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'admin-assets');
  END IF;
END $$;

-- Create service role update policy (allows server-side updates via service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Service role can update admin-assets'
  ) THEN
    CREATE POLICY "Service role can update admin-assets"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'admin-assets')
    WITH CHECK (bucket_id = 'admin-assets');
  END IF;
END $$;

-- Create service role delete policy (allows server-side deletions via service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Service role can delete from admin-assets'
  ) THEN
    CREATE POLICY "Service role can delete from admin-assets"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'admin-assets');
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads. admin-assets bucket stores book covers and event posters.';
