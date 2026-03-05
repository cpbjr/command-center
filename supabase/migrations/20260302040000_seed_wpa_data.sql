-- Migration: Seed initial WPA data
-- Date: 2026-03-02
-- Rollback: DELETE FROM public.wpa_tasks; DELETE FROM public.wpa_projects; DELETE FROM public.wpa_clients;

-- Clients
INSERT INTO public.wpa_clients (name, service_tier, monthly_revenue, current_phase, next_action, status, start_date, notes) VALUES
  ('Dog-Zen', 'Lazy Ranking', 65.00, 'GBP Optimization', 'Citation building week 2', 'active', '2026-02-15', 'Dog grooming salon in Eagle. GBP recovery after suspension.'),
  ('Harveys on the Green', 'Core 30', 0.00, 'Portfolio Build', 'Complete website build', 'active', '2026-02-20', 'Restaurant at Banbury Golf Course. Website + GBP optimization.')
ON CONFLICT DO NOTHING;

-- Projects
INSERT INTO public.wpa_projects (name, description, status, progress_pct, next_milestone, client_id) VALUES
  ('WPA Command Center', 'Internal dashboard replacing Atomic CRM', 'active', 50, 'MVP deployment', NULL),
  ('WPA Website', 'White Pine Agency marketing site', 'completed', 100, '', NULL),
  ('Dog-Zen GBP Optimization', 'Full GBP optimization for Dog-Zen', 'active', 30, 'Week 2 citations complete', (SELECT id FROM public.wpa_clients WHERE name = 'Dog-Zen' LIMIT 1)),
  ('Harveys Website Build', 'Core 30 site build for Harveys', 'active', 10, 'Design review', (SELECT id FROM public.wpa_clients WHERE name = 'Harveys on the Green' LIMIT 1))
ON CONFLICT DO NOTHING;

-- Sample tasks
INSERT INTO public.wpa_tasks (title, description, category, status, priority, client_id, due_date) VALUES
  ('Complete citation submissions', 'Submit to Apple Maps, Bing Places, BBB', 'Client Work', 'in_progress', 'high', (SELECT id FROM public.wpa_clients WHERE name = 'Dog-Zen' LIMIT 1), '2026-03-07'),
  ('Build Harveys website', 'Core 30 multi-page site with service-city pages', 'Client Work', 'todo', 'high', (SELECT id FROM public.wpa_clients WHERE name = 'Harveys on the Green' LIMIT 1), '2026-03-15'),
  ('Deploy Command Center', 'Build and deploy to dashboard.whitepineagency.com', 'Infrastructure', 'in_progress', 'urgent', NULL, '2026-03-02'),
  ('Set up cost tracking cron', 'Configure nightly sync-costs.sh on beefy', 'Infrastructure', 'todo', 'medium', NULL, '2026-03-05'),
  ('Canvass Eagle businesses', 'Walk Main Street with iPad showing lead sites', 'WPA Own', 'todo', 'medium', NULL, '2026-03-08')
ON CONFLICT DO NOTHING;

-- Sample cost data (last few days for testing)
INSERT INTO public.daily_costs (date, openai_tokens, openai_cost, anthropic_tokens, anthropic_cost, moonshot_tokens, moonshot_cost, total_cost) VALUES
  ('2026-02-28', 150000, 0.4500, 500000, 2.5000, 0, 0, 2.9500),
  ('2026-03-01', 120000, 0.3600, 450000, 2.2500, 50000, 0.1000, 2.7100),
  ('2026-03-02', 180000, 0.5400, 600000, 3.0000, 30000, 0.0600, 3.6000)
ON CONFLICT (date) DO NOTHING;
