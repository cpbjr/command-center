-- Migration: Add folder_path to wpa.wpa_businesses (correct schema)
-- Date: 2026-03-15
-- Fixes: Previous migration incorrectly targeted public.businesses instead of wpa.wpa_businesses

ALTER TABLE wpa.wpa_businesses ADD COLUMN IF NOT EXISTS folder_path TEXT;

COMMENT ON COLUMN wpa.wpa_businesses.folder_path IS 'File server path relative to /files/ root, e.g. WhitePineAgency/Clients/Leads/Goodrich-Plumbing-Idaho';

-- Seed known lead folders using exact IDs
UPDATE wpa.wpa_businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Everything-Irrigation'
  WHERE id = 'manual_everything_irrigation_20260305';

UPDATE wpa.wpa_businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Goodrich-Plumbing-Idaho'
  WHERE id = 'ChIJN8-honv92YgRuLIMKX5txf0';

UPDATE wpa.wpa_businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Janets-Cafe'
  WHERE id = 'ChIJNSyccwOrr1QRV7rxMHcADkQ';

UPDATE wpa.wpa_businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Native-Landscape-Services'
  WHERE id IN ('manual_native_landscape_services', 'manual_native_landscape_20260309');

UPDATE wpa.wpa_businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Heritage-Plumbing-LLC'
  WHERE id = 'ChIJQ3Jt9ydVrlQRL_flgbHTHRQ';

UPDATE wpa.wpa_businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Sarahs-Bagel-Cafe'
  WHERE id IN ('ChIJlTl5rOBTrlQRtwsuwGIy20g', 'ChIJXeRsbOUBr1QR4Uqh8gguEX4', 'sarahs-bagel-cafe-eagle');

UPDATE wpa.wpa_businesses SET folder_path = 'WhitePineAgency/Clients/Leads/M-2-Landscape-Contractors-Inc'
  WHERE id = 'ChIJbdkFGXKqr1QRiEuktW6pY7Y';

UPDATE wpa.wpa_businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Seasonal-Lawncare'
  WHERE id = 'ChIJwSbbdR0J04kR19HojMss21I';
