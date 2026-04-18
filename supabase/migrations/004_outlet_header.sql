-- Add header customization to outlets
ALTER TABLE outlets
  ADD COLUMN IF NOT EXISTS header_image_url TEXT,
  ADD COLUMN IF NOT EXISTS header_use_photo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_table_number INT DEFAULT 20,
  ADD COLUMN IF NOT EXISTS table_number_label TEXT DEFAULT 'Nomor Meja';
