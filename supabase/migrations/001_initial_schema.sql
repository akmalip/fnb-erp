-- ============================================================
-- FNB ERP - Supabase Schema v1.0
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- OUTLETS (1 F&B bisnis = 1 outlet / tenant)
CREATE TABLE outlets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#C8873A',
  secondary_color TEXT DEFAULT '#2C1810',
  accent_color TEXT DEFAULT '#F5E6D3',
  font_choice TEXT DEFAULT 'Plus Jakarta Sans',
  qris_image_url TEXT,
  is_open BOOLEAN DEFAULT true,
  open_time TIME DEFAULT '07:00',
  close_time TIME DEFAULT '22:00',
  subscription_plan TEXT DEFAULT 'basic',
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OUTLET USERS (akses dashboard per outlet)
CREATE TABLE outlet_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outlet_id, user_id)
);

-- MENU CATEGORIES
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '☕',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MENU ITEMS
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price INT NOT NULL,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  track_stock BOOLEAN DEFAULT false,
  stock_qty INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BANNERS & PROMO CARDS
CREATE TABLE outlet_banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  bg_color TEXT DEFAULT '#C8873A',
  text_color TEXT DEFAULT '#FFFFFF',
  icon_emoji TEXT DEFAULT '🎉',
  banner_type TEXT DEFAULT 'promo',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CUSTOMERS (aset data - wajib ada)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  first_outlet_id UUID REFERENCES outlets(id),
  first_visited_at TIMESTAMPTZ DEFAULT NOW(),
  last_visited_at TIMESTAMPTZ DEFAULT NOW(),
  total_visits INT DEFAULT 1,
  total_spent INT DEFAULT 0,
  marketing_consent BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(whatsapp)
);

-- CUSTOMER <-> OUTLET (1 customer bisa ke banyak outlet)
CREATE TABLE customer_outlets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  visit_count INT DEFAULT 1,
  total_spent_here INT DEFAULT 0,
  first_visit_at TIMESTAMPTZ DEFAULT NOW(),
  last_visit_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, outlet_id)
);

-- ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  table_number TEXT,
  status TEXT DEFAULT 'pending',
  subtotal INT NOT NULL DEFAULT 0,
  discount_amount INT DEFAULT 0,
  total_amount INT NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'qris',
  payment_status TEXT DEFAULT 'unpaid',
  payment_proof_url TEXT,
  payment_confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER ITEMS (snapshot immutable)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_price INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  subtotal INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_orders_outlet ON orders(outlet_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_menu_items_outlet ON menu_items(outlet_id);
CREATE INDEX idx_menu_category ON menu_items(category_id);
CREATE INDEX idx_customers_wa ON customers(whatsapp);

-- ROW LEVEL SECURITY
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_outlets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outlet_staff_access" ON outlets
  USING (id IN (SELECT outlet_id FROM outlet_users WHERE user_id = auth.uid()));

CREATE POLICY "menu_public_read" ON menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "menu_staff_write" ON menu_items
  USING (outlet_id IN (SELECT outlet_id FROM outlet_users WHERE user_id = auth.uid()));

CREATE POLICY "banners_public_read" ON outlet_banners FOR SELECT USING (is_active = true);
CREATE POLICY "banners_staff_write" ON outlet_banners
  USING (outlet_id IN (SELECT outlet_id FROM outlet_users WHERE user_id = auth.uid()));

CREATE POLICY "orders_staff_access" ON orders
  USING (outlet_id IN (SELECT outlet_id FROM outlet_users WHERE user_id = auth.uid()));

CREATE POLICY "customers_staff_access" ON customers
  USING (id IN (SELECT customer_id FROM customer_outlets WHERE outlet_id IN (
    SELECT outlet_id FROM outlet_users WHERE user_id = auth.uid()
  )));

-- REALTIME untuk order queue kasir
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- AUTO UPDATE TIMESTAMP
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER menu_updated BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER outlets_updated BEFORE UPDATE ON outlets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- GENERATE ORDER NUMBER (ex: KK-20240417-001)
CREATE OR REPLACE FUNCTION generate_order_number(p_outlet_id UUID) RETURNS TEXT AS $$
DECLARE v_slug TEXT; v_count INT;
BEGIN
  SELECT UPPER(LEFT(slug, 2)) INTO v_slug FROM outlets WHERE id = p_outlet_id;
  SELECT COUNT(*) + 1 INTO v_count FROM orders WHERE outlet_id = p_outlet_id AND DATE(created_at) = CURRENT_DATE;
  RETURN v_slug || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(v_count::TEXT, 3, '0');
END; $$ LANGUAGE plpgsql;

-- UPSERT CUSTOMER (kalau WA sudah ada, update visit count)
CREATE OR REPLACE FUNCTION upsert_customer(
  p_name TEXT, p_whatsapp TEXT, p_email TEXT DEFAULT NULL, p_outlet_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO customers (name, whatsapp, email, first_outlet_id)
  VALUES (p_name, p_whatsapp, p_email, p_outlet_id)
  ON CONFLICT (whatsapp) DO UPDATE SET
    last_visited_at = NOW(), total_visits = customers.total_visits + 1, name = EXCLUDED.name
  RETURNING id INTO v_id;
  IF p_outlet_id IS NOT NULL THEN
    INSERT INTO customer_outlets (customer_id, outlet_id) VALUES (v_id, p_outlet_id)
    ON CONFLICT (customer_id, outlet_id) DO UPDATE SET
      visit_count = customer_outlets.visit_count + 1, last_visit_at = NOW();
  END IF;
  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- SEED DATA
INSERT INTO outlets (slug, name, description, address, phone)
VALUES ('kopi-kenangan-sbm', 'Kopi Kenangan', 'Coffee shop specialty Sukabumi', 'Jl. Bhayangkara No.12, Sukabumi', '082112341234');
