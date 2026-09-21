-- Seed products from merged ecommerce and POS mock data
-- This merges the 17 products from both sources into unified database records

-- Batteries
INSERT INTO products (name, sku, brand, price, stock, category, image_url, description, barcode, cost_price, threshold, featured, is_active, units_sold, created_at, updated_at) VALUES
('S75 Premium Car Battery', 'BAT-BOSCH-12V', 'Bosch', 45000, 15, 'batteries', '/car-battery-bosch.jpg', '12V 75Ah high-performance battery with 3-year warranty', 'BAT-BOSCH-12V-001', 35000, 5, true, true, 0, NOW(), NOW()),
('Freedom Battery 75Ah', 'BAT-DELCO-75', 'Delco', 38000, 8, 'batteries', '/delco-car-battery.jpg', 'Reliable 75Ah battery for all vehicle types', 'BAT-DELCO-75-002', 28000, 5, false, true, 0, NOW(), NOW());

-- Filters  
INSERT INTO products (name, sku, brand, price, stock, category, image_url, description, barcode, cost_price, threshold, featured, is_active, units_sold, created_at, updated_at) VALUES
('Oil Filter Genuine', 'FLT-TOY-OIL', 'Toyota', 2500, 45, 'filters', '/toyota-oil-filter.jpg', 'OEM quality oil filter for Toyota vehicles', 'FLT-TOY-OIL-001', 1800, 10, true, true, 0, NOW(), NOW()),
('Universal Air Filter', 'FLT-UNI-AIR', 'Mann', 3500, 32, 'filters', '/car-air-filter.jpg', 'High-flow air filter for improved engine performance', 'FLT-UNI-AIR-002', 2500, 10, false, true, 0, NOW(), NOW()),
('Fuel Filter Premium', 'FLT-HON-FUEL', 'Honda', 4200, 18, 'filters', '/honda-fuel-filter.jpg', 'Genuine Honda fuel filter for optimal fuel delivery', 'FLT-HON-FUEL-003', 3000, 10, false, true, 0, NOW(), NOW());

-- Engine Parts
INSERT INTO products (name, sku, brand, price, stock, category, image_url, description, barcode, cost_price, threshold, featured, is_active, units_sold, created_at, updated_at) VALUES
('Spark Plug Set', 'ENG-SPARK-4', 'NGK', 8500, 25, 'engine-parts', '/spark-plugs-set-automotive.jpg', 'Set of 4 platinum spark plugs for better ignition', 'ENG-SPARK-4-001', 6000, 5, true, true, 0, NOW(), NOW()),
('Timing Belt Kit Complete', 'ENG-TIM-KIT', 'Gates', 22000, 6, 'engine-parts', '/timing-belt-kit-car.jpg', 'Complete timing belt kit with tensioners and pulleys', 'ENG-TIM-KIT-002', 16000, 3, true, true, 0, NOW(), NOW()),
('Engine Mount Rubber', 'ENG-MOUNT-01', 'Febi', 15000, 12, 'engine-parts', '/engine-mount-automotive.jpg', 'Heavy-duty engine mount for reduced vibration', 'ENG-MOUNT-01-003', 11000, 5, false, true, 0, NOW(), NOW());

-- Brakes
INSERT INTO products (name, sku, brand, price, stock, category, image_url, description, barcode, cost_price, threshold, featured, is_active, units_sold, created_at, updated_at) VALUES
('Front Brake Pads Ceramic', 'BRK-PAD-FRT', 'Brembo', 12000, 20, 'brakes', '/front-brake-pads-car.jpg', 'Low-dust ceramic brake pads for superior stopping power', 'BRK-PAD-FRT-001', 8500, 5, true, true, 0, NOW(), NOW()),
('Rear Brake Disc Set', 'BRK-DSC-RER', 'ATE', 18500, 10, 'brakes', '/rear-brake-disc-rotor.jpg', 'Ventilated brake disc for better heat dissipation', 'BRK-DSC-RER-002', 13000, 3, false, true, 0, NOW(), NOW());

-- Electrical
INSERT INTO products (name, sku, brand, price, stock, category, image_url, description, barcode, cost_price, threshold, featured, is_active, units_sold, created_at, updated_at) VALUES
('Alternator 90A', 'ELC-ALT-UNI', 'Denso', 35000, 5, 'electrical', '/car-alternator.jpg', 'High-output alternator for modern vehicles', 'ELC-ALT-UNI-001', 25000, 2, false, true, 0, NOW(), NOW()),
('Starter Motor Heavy Duty', 'ELC-START-01', 'Valeo', 28000, 7, 'electrical', '/car-starter-motor.jpg', 'Reliable starter motor with enhanced cranking power', 'ELC-START-01-002', 20000, 3, true, true, 0, NOW(), NOW());

-- Lubricants
INSERT INTO products (name, sku, brand, price, stock, category, image_url, description, barcode, cost_price, threshold, featured, is_active, units_sold, created_at, updated_at) VALUES
('1 Advanced 5W-30', 'LUB-MOB-5W30', 'Mobil', 18000, 30, 'lubricants', '/mobil-1-engine-oil-bottle.jpg', '4L fully synthetic engine oil for maximum protection', 'LUB-MOB-5W30-001', 13000, 10, true, true, 0, NOW(), NOW()),
('Helix Ultra 10W-40', 'LUB-SHL-10W40', 'Shell', 15000, 35, 'lubricants', '/shell-helix-engine-oil.jpg', '4L semi-synthetic engine oil for all conditions', 'LUB-SHL-10W40-002', 11000, 10, false, true, 0, NOW(), NOW()),
('Brake Fluid DOT4', 'LUB-BRK-DOT4', 'Castrol', 3500, 40, 'lubricants', '/brake-fluid-dot4-bottle.jpg', 'High-quality brake fluid for all brake systems', 'LUB-BRK-DOT4-003', 2500, 15, false, true, 0, NOW(), NOW());

-- Accessories
INSERT INTO products (name, sku, brand, price, stock, category, image_url, description, barcode, cost_price, threshold, featured, is_active, units_sold, created_at, updated_at) VALUES
('Phone Holder Magnetic', 'ACC-PHN-HLD', 'Ugreen', 2500, 50, 'accessories', '/car-phone-holder-mount.jpg', 'Strong magnetic phone holder with 360° rotation', 'ACC-PHN-HLD-001', 1800, 20, false, true, 0, NOW(), NOW()),
('Floor Mat Set Rubber', 'ACC-MAT-SET', 'WeatherTech', 8000, 25, 'accessories', '/car-floor-mats-set.jpg', 'All-weather rubber floor mats set of 4', 'ACC-MAT-SET-002', 6000, 10, true, true, 0, NOW(), NOW()),
('LED Interior Light Strip', 'ACC-LED-INT', 'Philips', 4500, 30, 'accessories', '/car-led-interior-light.jpg', 'RGB LED strip for interior ambient lighting', 'ACC-LED-INT-003', 3200, 15, false, true, 0, NOW(), NOW());