-- Seed products with neutral generic catalog
INSERT INTO products (name, sku, brand, price, stock, category, image_url, description, barcode, cost_price, threshold, featured, is_active, units_sold, created_at, updated_at) VALUES
('Wireless Earbuds Pro', 'ELEC-001', 'TechSound', 25000, 50, 'electronics', '', 'High quality wireless earbuds with noise cancellation.', 'ELEC-001-001', 15000, 10, true, true, 0, NOW(), NOW()),
('Classic White Sneakers', 'FASH-001', 'UrbanStep', 18000, 30, 'fashion', '', 'Comfortable everyday sneakers in premium white leather.', 'FASH-001-002', 10000, 10, true, true, 0, NOW(), NOW()),
('Green Tea Collection', 'FOOD-001', 'NatureCup', 3500, 100, 'food-drinks', '', 'Premium organic green tea.', 'FOOD-001-003', 1800, 20, false, true, 0, NOW(), NOW()),
('Vitamin C Brightening Serum', 'HLTH-001', 'GlowSkin', 12000, 45, 'health-beauty', '', 'Brightening face serum for glowing skin.', 'HLTH-001-004', 6000, 15, true, true, 0, NOW(), NOW()),
('Desk Organizer Set', 'HOME-001', 'WorkSmart', 8500, 25, 'home-office', '', 'Multi-compartment desk organizer for a tidy workspace.', 'HOME-001-005', 4500, 8, false, true, 0, NOW(), NOW()),
('Universal Phone Case', 'PHON-001', 'CaseGuard', 2500, 200, 'phones-accessories', '', 'Durable protective phone case.', 'PHON-001-006', 1000, 30, false, true, 0, NOW(), NOW()),
('Premium Yoga Mat', 'SPRT-001', 'FlexFit', 9000, 40, 'sporting-goods', '', 'Non-slip yoga mat with alignment guides.', 'SPRT-001-007', 4500, 12, true, true, 0, NOW(), NOW()),
('A5 Hardcover Notebook', 'BOOK-001', 'WriteMore', 1800, 150, 'books-education', '', 'Premium hardcover notebook with 200 pages.', 'BOOK-001-008', 800, 25, false, true, 0, NOW(), NOW());