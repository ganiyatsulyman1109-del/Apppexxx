-- Ensure product image bucket exists and has reliable policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Allow authenticated users to upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their product images" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_owner" ON storage.objects;

CREATE POLICY "product_images_insert_authenticated" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND owner = auth.uid()
);

CREATE POLICY "product_images_select_public" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'product-images');

CREATE POLICY "product_images_update_owner" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'product-images' AND owner = auth.uid());

CREATE POLICY "product_images_delete_owner" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND owner = auth.uid());
