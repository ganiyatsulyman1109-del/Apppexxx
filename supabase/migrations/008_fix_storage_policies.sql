DROP POLICY IF EXISTS "Allow authenticated users to upload customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff and admin to read customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload ID cards" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff and admin to read ID cards" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their product images" ON storage.objects;

CREATE POLICY "Allow authenticated users to upload customer photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-photos' AND auth.uid() = owner);

CREATE POLICY "Allow staff and admin to read customer photos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'customer-photos' AND 
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "Allow authenticated users to upload ID cards" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'id-cards' AND auth.uid() = owner);

CREATE POLICY "Allow staff and admin to read ID cards" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'id-cards' AND 
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "Allow authenticated users to upload product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Allow public read access to product images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Allow authenticated users to update their product images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Allow authenticated users to delete their product images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid() = owner);
