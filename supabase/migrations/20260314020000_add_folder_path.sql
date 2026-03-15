-- Migration: Add folder_path to wpa_clients and businesses
-- Date: 2026-03-14
-- Rollback: ALTER TABLE public.wpa_clients DROP COLUMN IF EXISTS folder_path;
--           ALTER TABLE public.businesses DROP COLUMN IF EXISTS folder_path;

ALTER TABLE public.wpa_clients ADD COLUMN IF NOT EXISTS folder_path TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS folder_path TEXT;

COMMENT ON COLUMN public.wpa_clients.folder_path IS 'File server path relative to /files/ root, e.g. WhitePineAgency/Clients/Active/Dog-Zen';
COMMENT ON COLUMN public.businesses.folder_path IS 'File server path relative to /files/ root, e.g. WhitePineAgency/Clients/Leads/Goodrich-Plumbing-Idaho';

-- Seed known active client folders
UPDATE public.wpa_clients SET folder_path = 'WhitePineAgency/Clients/Active/Dog-Zen' WHERE name ILIKE '%dog zen%';
UPDATE public.wpa_clients SET folder_path = 'WhitePineAgency/Clients/Active/Harveys-on-the-Green' WHERE name ILIKE '%harvey%';

-- Seed known lead folders
UPDATE public.businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Goodrich-Plumbing-Idaho' WHERE name ILIKE '%goodrich%';
UPDATE public.businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Janets-Cafe' WHERE name ILIKE '%janet%';
UPDATE public.businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Native-Landscape-Services' WHERE name ILIKE '%native landscape%';
UPDATE public.businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Everything-Irrigation' WHERE name ILIKE '%everything irrigation%';
UPDATE public.businesses SET folder_path = 'WhitePineAgency/Clients/Leads/M-2-Landscape-Contractors-Inc' WHERE name ILIKE '%m-2%' OR name ILIKE '%m2 landscape%';
UPDATE public.businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Heritage-Plumbing-LLC' WHERE name ILIKE '%heritage plumbing%';
UPDATE public.businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Sarahs-Bagel-Cafe' WHERE name ILIKE '%sarah%bagel%';
UPDATE public.businesses SET folder_path = 'WhitePineAgency/Clients/Leads/Seasonal-Lawncare' WHERE name ILIKE '%seasonal%';
