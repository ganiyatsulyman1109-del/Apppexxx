-- Ensure customer photo bucket supports public rendering while keeping controlled uploads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-photos',
  'customer-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Allow authenticated users to upload customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff and admin to read customer photos" ON storage.objects;
DROP POLICY IF EXISTS "customer_photos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "customer_photos_select_public" ON storage.objects;

CREATE POLICY "customer_photos_insert_authenticated" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'customer-photos'
  AND auth.uid() IS NOT NULL
  AND owner = auth.uid()
);

CREATE POLICY "customer_photos_select_public" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'customer-photos');
