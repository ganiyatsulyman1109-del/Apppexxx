-- Create storage buckets for file uploads

-- Customer photos bucket for EasyBuy profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-photos',
  'customer-photos',
  false, -- private bucket
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- ID cards bucket for EasyBuy customer ID card photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-cards',
  'id-cards',
  false, -- private bucket
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Product images bucket for admin product uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true, -- public bucket for ecommerce display
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Set up access policies for customer-photos bucket
-- Allow authenticated users to upload their own photos
CREATE POLICY "Allow authenticated users to upload customer photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-photos' AND auth.uid() = owner);

-- Allow staff and admin to read customer photos
CREATE POLICY "Allow staff and admin to read customer photos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'customer-photos' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'staff')
  )
);

-- Set up access policies for id-cards bucket
-- Allow authenticated users to upload their own ID cards
CREATE POLICY "Allow authenticated users to upload ID cards" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'id-cards' AND auth.uid() = owner);

-- Allow staff and admin to read ID cards
CREATE POLICY "Allow staff and admin to read ID cards" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'id-cards' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'staff')
  )
);

-- Set up access policies for product-images bucket
-- Allow authenticated users to upload product images
CREATE POLICY "Allow authenticated users to upload product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND auth.uid() = owner);

-- Allow public read access to product images
CREATE POLICY "Allow public read access to product images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'product-images');

-- Allow authenticated users to update and delete their own product images
CREATE POLICY "Allow authenticated users to update their product images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Allow authenticated users to delete their product images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid() = owner);