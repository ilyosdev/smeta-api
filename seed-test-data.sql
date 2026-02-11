-- ============================================================
-- SMETA BOT TEST DATA SEED
-- Based on smeta_bot.txt examples
-- ============================================================

SET @orgId = 'dfde58ec-0378-11f1-8254-ee1dc215ebd8';
SET @projectA = 'dfe1349a-0378-11f1-8254-ee1dc215ebd8';
SET @projectB = 'dfe1562e-0378-11f1-8254-ee1dc215ebd8';
SET @ptoUser = 'dfe0dcb2-0378-11f1-8254-ee1dc215ebd8';

-- ============================================================
-- 1. USERS (one per role for testing)
-- ============================================================

-- Fix existing user
UPDATE users SET name = 'PTO Test' WHERE id = @ptoUser;

-- Add users for each role
INSERT IGNORE INTO users (id, org_id, name, phone, role, is_active) VALUES
  (UUID(), @orgId, 'Super Admin', '+998900000001', 'SUPER_ADMIN', 1),
  (UUID(), @orgId, 'Operator Test', '+998900000002', 'OPERATOR', 1),
  (UUID(), @orgId, 'Boss Test', '+998900000003', 'BOSS', 1),
  (UUID(), @orgId, 'Direktor Test', '+998900000004', 'DIREKTOR', 1),
  (UUID(), @orgId, 'Bugalter Test', '+998900000005', 'BUGALTERIYA', 1),
  (UUID(), @orgId, 'Snabjenets Test', '+998900000006', 'SNABJENIYA', 1),
  (UUID(), @orgId, 'Skladchi Test', '+998900000007', 'SKLAD', 1),
  (UUID(), @orgId, 'Prorab Jamshid', '+998900000008', 'PRORAB', 1);

-- ============================================================
-- 2. USER-PROJECT ASSIGNMENTS
-- ============================================================

INSERT IGNORE INTO user_projects (id, user_id, project_id) VALUES
  (UUID(), @ptoUser, @projectA),
  (UUID(), @ptoUser, @projectB);

-- Assign all users to both projects
INSERT IGNORE INTO user_projects (id, user_id, project_id)
SELECT UUID(), u.id, @projectA FROM users u WHERE u.org_id = @orgId AND u.id != @ptoUser;
INSERT IGNORE INTO user_projects (id, user_id, project_id)
SELECT UUID(), u.id, @projectB FROM users u WHERE u.org_id = @orgId AND u.id != @ptoUser;

-- ============================================================
-- 3. UPDATE PROJECT DETAILS (from smeta_bot.txt)
-- ============================================================

UPDATE projects SET
  budget = 3500000000,
  status = 'ACTIVE',
  address = 'Toshkent sh., Chilonzor tumani',
  floors = 9,
  description = 'Ko\'p qavatli turar-joy binosi'
WHERE id = @projectA;

UPDATE projects SET
  budget = 2000000000,
  status = 'ACTIVE',
  address = 'Toshkent sh., Yunusobod tumani',
  floors = 5,
  description = 'Ofis binosi qurilishi'
WHERE id = @projectB;

-- ============================================================
-- 4. ACCOUNTS (bank accounts)
-- ============================================================

INSERT INTO accounts (id, org_id, name, balance) VALUES
  (UUID(), @orgId, 'Asosiy hisob', 500000000),
  (UUID(), @orgId, 'Qo\'shimcha hisob', 150000000);

-- ============================================================
-- 5. SMETA + SMETA ITEMS (for PTO comparison & supply)
-- ============================================================

SET @smetaA = UUID();
SET @smetaB = UUID();

INSERT INTO smetas (id, project_id, type, name, current_version, total_work_amount, total_material_amount, grand_total) VALUES
  (@smetaA, @projectA, 'CONSTRUCTION', 'Asosiy qurilish smetasi', 1, 1500000000, 2000000000, 3500000000),
  (@smetaB, @projectB, 'CONSTRUCTION', 'Ofis binosi smetasi', 1, 800000000, 1200000000, 2000000000);

-- Smeta items for Project A
SET @si_suvoq = UUID();
SET @si_armatura = UUID();
SET @si_beton = UUID();
SET @si_gisht = UUID();
SET @si_razetka = UUID();
SET @si_sement = UUID();
SET @si_turbina = UUID();
SET @si_elektr = UUID();

INSERT INTO smeta_items (id, smeta_id, item_type, category, code, name, unit, quantity, unit_price, total_amount, used_quantity, used_amount) VALUES
  (@si_suvoq,    @smetaA, 'WORK',     'Pardozlash', 'W-001', 'Suvoq ishlari',        'm2',    1000,  45000,    45000000,   1050, 47250000),
  (@si_armatura, @smetaA, 'MATERIAL', 'Metall',     'M-001', 'Armatura (12mm)',       'tonna',   50, 7000000,  350000000,     35, 245000000),
  (@si_beton,    @smetaA, 'MATERIAL', 'Qurilish',   'M-002', 'Beton (M300)',          'tonna',  200, 1200000,  240000000,    120, 144000000),
  (@si_gisht,    @smetaA, 'MATERIAL', 'Qurilish',   'M-003', 'G''isht (klinker)',     'dona',  50000,   2500,  125000000,  30000, 75000000),
  (@si_razetka,  @smetaA, 'MATERIAL', 'Elektr',     'M-004', 'Razetka',              'dona',    500,  25000,   12500000,    100, 2500000),
  (@si_sement,   @smetaA, 'MATERIAL', 'Qurilish',   'M-005', 'Sement (M400)',        'tonna',  100, 1500000,  150000000,     65, 97500000),
  (@si_turbina,  @smetaA, 'MATERIAL', 'Ventilyatsiya','M-006','Turbina (kanal)',      'metr',   200,  120000,   24000000,    100, 12000000),
  (@si_elektr,   @smetaA, 'WORK',     'Elektr',     'W-002', 'Elektr montaj ishlari','metr',   500,  30000,   15000000,    200, 6000000);

-- Smeta items for Project B
SET @si_suvoqB = UUID();
SET @si_betonB = UUID();

INSERT INTO smeta_items (id, smeta_id, item_type, category, code, name, unit, quantity, unit_price, total_amount, used_quantity, used_amount) VALUES
  (@si_suvoqB, @smetaB, 'WORK',     'Pardozlash', 'W-001', 'Suvoq ishlari',  'm2',   500,  45000,  22500000,  200, 9000000),
  (@si_betonB, @smetaB, 'MATERIAL', 'Qurilish',   'M-002', 'Beton (M300)',   'tonna', 100, 1200000, 120000000,   40, 48000000);

-- ============================================================
-- 6. WORKERS (for Foreman + PTO)
-- ============================================================

SET @worker1 = UUID();
SET @worker2 = UUID();
SET @worker3 = UUID();
SET @worker4 = UUID();

INSERT INTO workers (id, org_id, name, phone, specialty, total_earned, total_paid) VALUES
  (@worker1, @orgId, 'Muso Usmonov',   '+998901234567', 'Suvokchi',     45000000, 22500000),
  (@worker2, @orgId, 'Anvarov Olim',   '+998901234568', 'Suvokchi',     45000000, 22500000),
  (@worker3, @orgId, 'Kamolov Rustam', '+998901234569', 'Betonchi',     30000000, 20000000),
  (@worker4, @orgId, 'Toshmatov Bahrom','+998901234570', 'Elektrik',    15000000,  8000000);

-- ============================================================
-- 7. WORK LOGS (mix of validated and unvalidated for PTO)
-- ============================================================

-- Get prorab user id for logged_by
SET @prorabId = (SELECT id FROM users WHERE role = 'PRORAB' AND org_id = @orgId LIMIT 1);

-- Validated work logs
INSERT INTO work_logs (id, project_id, worker_id, smeta_item_id, work_type, unit, quantity, unit_price, total_amount, date, logged_by_id, is_validated, validated_by_id, validated_at) VALUES
  (UUID(), @projectA, @worker1, @si_suvoq, 'Suvoq', 'm2', 500, 45000, 22500000, DATE_SUB(NOW(), INTERVAL 10 DAY), @ptoUser, 1, @ptoUser, DATE_SUB(NOW(), INTERVAL 9 DAY)),
  (UUID(), @projectA, @worker2, @si_suvoq, 'Suvoq', 'm2', 500, 45000, 22500000, DATE_SUB(NOW(), INTERVAL 8 DAY), @ptoUser, 1, @ptoUser, DATE_SUB(NOW(), INTERVAL 7 DAY)),
  (UUID(), @projectA, @worker3, @si_beton, 'Beton quyish', 'tonna', 60, 1200000, 72000000, DATE_SUB(NOW(), INTERVAL 6 DAY), @ptoUser, 1, @ptoUser, DATE_SUB(NOW(), INTERVAL 5 DAY));

-- UNVALIDATED work logs (for PTO to approve/reject)
INSERT INTO work_logs (id, project_id, worker_id, smeta_item_id, work_type, unit, quantity, unit_price, total_amount, date, logged_by_id, is_validated) VALUES
  (UUID(), @projectA, @worker1, @si_suvoq,    'Suvoq',           'm2',    120,  NULL,     NULL,     DATE_SUB(NOW(), INTERVAL 2 DAY), COALESCE(@prorabId, @ptoUser), 0),
  (UUID(), @projectA, @worker2, @si_suvoq,    'Suvoq',           'm2',     80,  NULL,     NULL,     DATE_SUB(NOW(), INTERVAL 1 DAY), COALESCE(@prorabId, @ptoUser), 0),
  (UUID(), @projectA, @worker3, @si_beton,    'Beton quyish',    'tonna',  30,  NULL,     NULL,     NOW(),                           COALESCE(@prorabId, @ptoUser), 0),
  (UUID(), @projectA, @worker4, @si_elektr,   'Elektr montaj',   'metr',  100,  30000,   3000000,  NOW(),                           COALESCE(@prorabId, @ptoUser), 0),
  (UUID(), @projectA, @worker1, @si_armatura, 'Armatura o''rnatish','tonna', 5, 7000000, 35000000, NOW(),                           COALESCE(@prorabId, @ptoUser), 0);

-- ============================================================
-- 8. WORKER PAYMENTS
-- ============================================================

INSERT INTO worker_payments (id, worker_id, amount, note, paid_by_id) VALUES
  (UUID(), @worker1, 22500000, 'Suvoq ishi uchun (500 m2 × 45,000)', COALESCE(@prorabId, @ptoUser)),
  (UUID(), @worker2, 22500000, 'Suvoq ishi uchun (500 m2 × 45,000)', COALESCE(@prorabId, @ptoUser)),
  (UUID(), @worker3, 20000000, 'Beton quyish ishi uchun',             COALESCE(@prorabId, @ptoUser)),
  (UUID(), @worker4,  8000000, 'Elektr montaj ishlari uchun',         COALESCE(@prorabId, @ptoUser));

-- ============================================================
-- 9. SUPPLIERS + ORDERS + DEBTS (for Supply role)
-- ============================================================

SET @supplier1 = UUID();
SET @supplier2 = UUID();
SET @supplier3 = UUID();

INSERT INTO suppliers (id, org_id, name, phone, address) VALUES
  (@supplier1, @orgId, 'Temir-beton zavodi X',   '+998712345678', 'Toshkent sh., Sergeli'),
  (@supplier2, @orgId, 'Elektro-Snab',           '+998712345679', 'Toshkent sh., Mirzo Ulug''bek'),
  (@supplier3, @orgId, 'Qurilish Materiallari Y', '+998712345680', 'Toshkent sh., Yakkasaroy');

-- Supply orders
SET @order1 = UUID();
SET @order2 = UUID();
SET @order3 = UUID();

INSERT INTO supply_orders (id, supplier_id, project_id, status, total_cost, note, ordered_by_id, delivered_at) VALUES
  (@order1, @supplier1, @projectA, 'DELIVERED', 35000000,  'Armatura yetkazib berildi',  COALESCE(@prorabId, @ptoUser), DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (@order2, @supplier1, @projectA, 'ORDERED',   84000000,  'Beton buyurtmasi',           COALESCE(@prorabId, @ptoUser), NULL),
  (@order3, @supplier2, @projectA, 'DELIVERED',  2500000,  'Razetka va kabel',           COALESCE(@prorabId, @ptoUser), DATE_SUB(NOW(), INTERVAL 3 DAY));

-- Supply order items
INSERT INTO supply_order_items (id, order_id, name, unit, quantity, unit_price, total_cost, smeta_item_id) VALUES
  (UUID(), @order1, 'Armatura 12mm',   'tonna', 5,   7000000, 35000000, @si_armatura),
  (UUID(), @order2, 'Beton M300',      'tonna', 10,  1200000, 12000000, @si_beton),
  (UUID(), @order2, 'Beton M300 (2)',  'tonna', 60,  1200000, 72000000, @si_beton),
  (UUID(), @order3, 'Razetka',         'dona',  100,   25000,  2500000, @si_razetka);

-- Supplier debts
INSERT INTO supplier_debts (id, supplier_id, amount, reason, order_id, is_paid, paid_at, paid_by_id) VALUES
  (UUID(), @supplier1, 35000000, 'Armatura yetkazib berildi',        @order1, 1, DATE_SUB(NOW(), INTERVAL 4 DAY), COALESCE(@prorabId, @ptoUser)),
  (UUID(), @supplier1, 84000000, 'Beton buyurtmasi (kutilmoqda)',    @order2, 0, NULL, NULL),
  (UUID(), @supplier2,  2500000, 'Razetka va kabel yetkazib berildi',@order3, 0, NULL, NULL),
  (UUID(), @supplier3,  3000000, 'Armatura 8 talik',                 NULL,    0, NULL, NULL);

-- ============================================================
-- 10. WAREHOUSES + ITEMS (for Warehouse role)
-- ============================================================

SET @warehouseA = UUID();
SET @warehouseB = UUID();

INSERT INTO warehouses (id, project_id, name, location) VALUES
  (@warehouseA, @projectA, 'A skladi',  'Qurilish maydoni, Chilonzor'),
  (@warehouseB, @projectB, 'B skladi',  'Qurilish maydoni, Yunusobod');

INSERT INTO warehouse_items (id, warehouse_id, name, unit, quantity, smeta_item_id) VALUES
  (UUID(), @warehouseA, 'Razetka',          'dona',   100, @si_razetka),
  (UUID(), @warehouseA, 'Turbina (kanal)',   'metr',   100, @si_turbina),
  (UUID(), @warehouseA, 'Armatura 12mm',    'tonna',   10, @si_armatura),
  (UUID(), @warehouseA, 'Sement M400',      'tonna',   15, @si_sement),
  (UUID(), @warehouseA, 'G''isht (klinker)', 'dona', 5000, @si_gisht),
  (UUID(), @warehouseB, 'Razetka',          'dona',    50, NULL),
  (UUID(), @warehouseB, 'Beton M300',       'tonna',   20, NULL);

-- Warehouse transfer (pending)
INSERT INTO warehouse_transfers (id, from_warehouse_id, to_warehouse_id, item_name, unit, quantity, status, created_by_id) VALUES
  (UUID(), @warehouseA, @warehouseB, 'Razetka', 'dona', 20, 'PENDING', COALESCE(@prorabId, @ptoUser));

-- ============================================================
-- 11. FIX EXISTING + ADD MORE INCOMES
-- ============================================================

-- Fix broken income (was 500 instead of 500,000,000)
UPDATE incomes SET amount = 500000000, source = 'Karimov (Investor)', note = 'Investor to''lovi' WHERE amount = 500;

-- Add more incomes
INSERT INTO incomes (id, project_id, amount, source, payment_type, note, recorded_by_id) VALUES
  (UUID(), @projectA, 800000000,  'Davlat granti',         'TRANSFER', 'Davlat qurilish granti',    @ptoUser),
  (UUID(), @projectA, 300000000,  'Bank krediti',           'TRANSFER', 'Qurilish uchun kredit',     @ptoUser),
  (UUID(), @projectA, 500000000,  'Sherik investitsiyasi',  'CASH',     'Sherik Alimov to''lovi',    @ptoUser),
  (UUID(), @projectB, 400000000,  'Buyurtmachi',           'TRANSFER', 'Birinchi to''lov',           @ptoUser),
  (UUID(), @projectB, 300000000,  'Buyurtmachi',           'CASH',     'Ikkinchi to''lov',           @ptoUser);

-- ============================================================
-- 12. FIX EXISTING + ADD MORE EXPENSES
-- ============================================================

-- Fix broken expense
UPDATE expenses SET amount = 500000000, note = 'Kvartira arendasi' WHERE amount = 500;

-- Add more expenses
INSERT INTO expenses (id, project_id, amount, recipient, payment_type, category, is_paid, note, recorded_by_id) VALUES
  (UUID(), @projectA, 350000000, 'Temir-beton zavodi X',   'TRANSFER', 'MATERIAL',  1, 'Armatura va beton uchun',        @ptoUser),
  (UUID(), @projectA, 150000000, 'Sement do''koni',        'CASH',     'MATERIAL',  1, 'Sement M400 - 100 tonna',        @ptoUser),
  (UUID(), @projectA,  45000000, 'Ishchilar maoshi',       'CASH',     'LABOR',     1, 'Suvokchilar maoshi',             @ptoUser),
  (UUID(), @projectA,  30000000, 'Transport xizmati',      'CASH',     'TRANSPORT', 1, 'Material tashish',               @ptoUser),
  (UUID(), @projectA,  10000000, 'Ofis harajatlari',       'CASH',     'OTHER',     1, 'Kvartira arendasi',              @ptoUser),
  (UUID(), @projectA,  10000000, 'Qurilma ijarasi',        'TRANSFER', 'EQUIPMENT', 1, 'Kran ijarasi - 1 oy',            @ptoUser),
  (UUID(), @projectB, 200000000, 'Beton zavodi',           'TRANSFER', 'MATERIAL',  1, 'Beton M300',                     @ptoUser),
  (UUID(), @projectB,  50000000, 'Ishchilar',              'CASH',     'LABOR',     1, 'Oylik maosh',                    @ptoUser);

-- Unpaid expenses (pending - for Boss view)
INSERT INTO expenses (id, project_id, amount, recipient, payment_type, category, is_paid, note, recorded_by_id) VALUES
  (UUID(), @projectA, 120000000, 'Beton buyurtmasi',  'TRANSFER', 'MATERIAL', 0, 'Beton 10 tonna - kutilmoqda',  @ptoUser),
  (UUID(), @projectA,  80000000, 'G''isht buyurtmasi', 'CASH',     'MATERIAL', 0, 'G''isht 10 kamaz - kutilmoqda', @ptoUser);

-- ============================================================
-- 13. CASH REGISTERS (fix existing + add per-project)
-- ============================================================

-- Fix existing cash register
UPDATE cash_registers SET balance = 45000000, total_in = 500000000, total_out = 455000000, project_id = @projectA WHERE id = '7abdb87f-3f20-44e6-8aea-a43a688b0ba5';

-- Add cash register for project B
INSERT INTO cash_registers (id, user_id, project_id, name, balance, total_in, total_out) VALUES
  (UUID(), @ptoUser, @projectB, 'B loyiha kassasi', 100000000, 300000000, 200000000);

-- ============================================================
-- 14. CASH TRANSACTIONS
-- ============================================================

INSERT INTO cash_transactions (id, cash_register_id, type, amount, note) VALUES
  (UUID(), '7abdb87f-3f20-44e6-8aea-a43a688b0ba5', 'IN',  500000000, 'Investor Karimov dan'),
  (UUID(), '7abdb87f-3f20-44e6-8aea-a43a688b0ba5', 'OUT', 300000000, 'Material harid'),
  (UUID(), '7abdb87f-3f20-44e6-8aea-a43a688b0ba5', 'OUT', 100000000, 'Ishchilar maoshi'),
  (UUID(), '7abdb87f-3f20-44e6-8aea-a43a688b0ba5', 'OUT',  55000000, 'Transport va boshqa');

-- ============================================================
-- 15. CASH REQUESTS (for Foreman + Boss)
-- ============================================================

-- Keep existing one, add more
INSERT INTO cash_requests (id, project_id, requested_by_id, amount, reason, status, source) VALUES
  (UUID(), @projectA, COALESCE(@prorabId, @ptoUser), 10000000,  'Kundalik rasxodlar - Prorab Jamshid', 'PENDING',  'TELEGRAM'),
  (UUID(), @projectA, COALESCE(@prorabId, @ptoUser),  5000000,  'Mix va mayda materiallar',            'PENDING',  'TELEGRAM'),
  (UUID(), @projectB, COALESCE(@prorabId, @ptoUser), 15000000,  'Ishchilar transport xarajati',        'APPROVED', 'TELEGRAM');

-- ============================================================
-- 16. PURCHASE REQUESTS (for Supply + Boss pending view)
-- ============================================================

INSERT INTO purchase_requests (id, smeta_item_id, requested_qty, requested_amount, note, status, requested_by_id, source) VALUES
  (UUID(), @si_beton,    10,  12000000, 'Poydevor qurish uchun - ertaga kerak', 'PENDING',  COALESCE(@prorabId, @ptoUser), 'TELEGRAM'),
  (UUID(), @si_gisht, 10000,  25000000, 'Devor ko''tarish uchun',               'PENDING',  COALESCE(@prorabId, @ptoUser), 'TELEGRAM'),
  (UUID(), @si_sement,   20,  30000000, 'Suvoq ishlari uchun',                  'APPROVED', COALESCE(@prorabId, @ptoUser), 'TELEGRAM');

-- ============================================================
-- DONE! Summary:
-- Users: 9 (1 per role)
-- Projects: 2 (A + B) with budgets
-- Smetas: 2 with 10 items total
-- Workers: 4 (Suvokchi, Betonchi, Elektrik)
-- Work logs: 8 (3 validated + 5 unvalidated for PTO)
-- Worker payments: 4
-- Suppliers: 3
-- Supply orders: 3 with 4 items
-- Supplier debts: 4 (1 paid + 3 unpaid)
-- Warehouses: 2 with 7 items + 1 pending transfer
-- Incomes: 6 (~2.1B total for Project A)
-- Expenses: 10 paid + 2 unpaid (~1.92B total)
-- Cash registers: 2
-- Cash requests: 4
-- Purchase requests: 3
-- ============================================================
