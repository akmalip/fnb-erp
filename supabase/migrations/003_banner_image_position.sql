-- Add image position and zoom controls to outlet_banners
ALTER TABLE outlet_banners 
  ADD COLUMN IF NOT EXISTS image_position_x INT DEFAULT 50,  -- 0-100, horizontal %
  ADD COLUMN IF NOT EXISTS image_position_y INT DEFAULT 50,  -- 0-100, vertical %
  ADD COLUMN IF NOT EXISTS image_zoom INT DEFAULT 100;       -- 100-200, zoom %

COMMENT ON COLUMN outlet_banners.image_position_x IS 'Horizontal position 0(left)-100(right), default center 50';
COMMENT ON COLUMN outlet_banners.image_position_y IS 'Vertical position 0(top)-100(bottom), default center 50';
COMMENT ON COLUMN outlet_banners.image_zoom IS 'Zoom level 100(normal) to 200(2x zoom)';
