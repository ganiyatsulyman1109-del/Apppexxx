-- Add photo URL columns to easybuy_customers table
ALTER TABLE easybuy_customers 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS id_photo_url TEXT;