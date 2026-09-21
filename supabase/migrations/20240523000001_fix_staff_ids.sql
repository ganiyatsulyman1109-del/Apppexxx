
-- Fix staff ID format to use 3 digits padding instead of 4
UPDATE staff 
SET staff_id = CONCAT('STAFF', LPAD(CAST(REGEXP_REPLACE(staff_id, '[^0-9]', '', 'g') AS INTEGER)::text, 3, '0')) 
WHERE staff_id LIKE 'STAFF%';
