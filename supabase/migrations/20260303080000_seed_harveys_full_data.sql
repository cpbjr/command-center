-- Migration: Seed Harvey's complete data from CLIENT-MASTER.md
-- Date: 2026-03-03

-- 1. UPDATE wpa_clients record (already exists from seed)
UPDATE public.wpa_clients SET
  name          = 'Harvey''s at BanBury',
  service_tier  = 'Quick Win',
  monthly_revenue = 0.00,
  current_phase = 'Phase 1 - GBP Optimization',
  next_action   = 'Follow up Nate: photos + delivery info. Chase Lightspeed (Brad) re schema access.',
  status        = 'active',
  start_date    = '2026-02-20',
  address       = '2626 S Marypost Pl, Eagle, ID 83616',
  phone         = '(208) 939-3600',
  website_url   = 'https://banburygolf.com',
  notes         = 'Restaurant at Banbury Golf Course. Phase 1: free Quick Win (GBP opt + schema). Ask: testimonial + referrals. Phase 2 (paid, trigger: Phase 1 results): standalone Harvey''s website, mobile perf fix, Core 30 build. Tech constraint: Lightspeed Golf (managed WP/WP Engine) controls banburygolf.com — schema changes require their support team.'
WHERE name IN ('Harveys on the Green', 'Harvey''s at BanBury');

-- 2. INSERT Nate Mitchell contact record
INSERT INTO public.wpa_contacts (client_id, name, last_name, role, phone, email, is_primary, notes)
VALUES (
  (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1),
  'Nate', 'Mitchell', 'General Manager',
  '(208) 939-3600', 'Nate@banburygolf.com',
  true,
  'Decision maker. Christopher works at Banbury — easy in-person access. Warm relationship.'
);

-- 3. INSERT wpa_client_activity log (comm log)
INSERT INTO public.wpa_client_activity (client_id, type, summary, occurred_at) VALUES
  ((SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), 'note',    'Pitch planned for 2026-02-18',                                                              '2026-02-17T00:00:00Z'),
  ((SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), 'meeting', 'In-person pitch delivered at Banbury',                                                     '2026-02-18T00:00:00Z'),
  ((SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), 'meeting', 'Nate said YES. Deal: free Quick Win. GBP listed as "Clubhouse Restaurant" — pivot to brand fix.', '2026-02-20T00:00:00Z'),
  ((SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), 'action',  'GBP listing claimed (christopher@whitepineagency.com)',                                    '2026-02-20T00:00:00Z'),
  ((SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), 'action',  'GBP verification complete. Name corrected to Harvey''s at BanBury. Hours, description, phone, website updated.', '2026-02-21T00:00:00Z'),
  ((SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), 'action',  'GTrack day-0 baseline captured (keyword: restaurant, 5x5 grid)',                           '2026-02-21T00:00:00Z'),
  ((SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), 'meeting', 'Met Rob (Head Golf Pro) in person re Lightspeed schema access. Rob to forward Brad''s contact.', '2026-02-23T00:00:00Z'),
  ((SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), 'text',    'Text sent to Brad (Lightspeed) re schema markup access. Awaiting response.',              '2026-03-02T00:00:00Z');

-- 4. INSERT day-0 baseline snapshot
INSERT INTO public.wpa_client_baselines (
  client_id, snapshot_date, keyword,
  gtrack_avg_position, gtrack_best_position, gtrack_grid_size,
  gtrack_top3_count, gtrack_top10_count, gtrack_20plus_count,
  discovery_rank, discovery_total, discovery_query,
  gbp_rating, gbp_review_count,
  mobile_lcp_seconds, mobile_speed_score, has_schema,
  notes
) VALUES (
  (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1),
  '2026-02-21', 'restaurant',
  20.0, 1, 25,
  1, 0, 24,
  48, 60, 'restaurants in Eagle, ID',
  4.1, 47,
  11.5, 44, false,
  'Pre-optimization baseline. GBP just claimed 2026-02-20. Only ranks #1 at exact business location. Top competitors: Coa Del Mar (#3 avg), Pig Latin (#4 avg). Discovery rank from nightly Bud scan.'
);

-- 5. INSERT Phase 1 completed tasks
INSERT INTO public.wpa_tasks (title, description, category, status, priority, client_id, completed_at) VALUES
  ('Claim GBP listing',          'Claimed via christopher@whitepineagency.com', 'Client Work', 'done', 'high',
    (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), '2026-02-20T00:00:00Z'),
  ('Fix GBP business name',      'Corrected "Clubhouse Restaurant" → "Harvey''s at BanBury"', 'Client Work', 'done', 'high',
    (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), '2026-02-21T00:00:00Z'),
  ('Complete GBP verification',  'Phone verification completed 2026-02-21', 'Client Work', 'done', 'high',
    (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), '2026-02-21T00:00:00Z'),
  ('Update GBP core fields',     'Hours, description, phone, website all updated', 'Client Work', 'done', 'medium',
    (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1), '2026-02-21T00:00:00Z');

-- 6. INSERT Phase 1 pending + blocked tasks
INSERT INTO public.wpa_tasks (title, description, category, status, priority, client_id) VALUES
  ('Source exterior photo for GBP',
   'WPA to source/shoot exterior photo of Harvey''s at BanBury for GBP listing.',
   'Client Work', 'todo', 'medium',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Add menu photo/link to GBP',
   'Awaiting menu info from Nate. Can use banburygolf.com/dining as placeholder if no dedicated menu link.',
   'Client Work', 'todo', 'medium',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Collect food/dish photos from Nate',
   'BLOCKED: Requested from Nate Mitchell, not yet received. Need 4-6 photos for GBP listing.',
   'Client Work', 'blocked', 'high',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Confirm delivery services (DoorDash/Uber Eats)',
   'BLOCKED: Awaiting info from Nate on whether Harvey''s is on any delivery platforms.',
   'Client Work', 'blocked', 'low',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Add Nate Mitchell as GBP owner',
   'BLOCKED: Needs Nate''s personal Google account. Discuss in person at Banbury. Currently only WPA (christopher@whitepineagency.com) has access.',
   'Client Work', 'blocked', 'medium',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Add Restaurant schema markup to banburygolf.com',
   'BLOCKED: Waiting on Brad (Lightspeed Golf support). Text sent 2026-03-02. Rob (Head Golf Pro) forwarded contact. Site runs on Lightspeed managed WP — WPA has no direct edit access.',
   'Client Work', 'blocked', 'high',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Discuss $500 Google Ads promo with Nate',
   'Google Ads $500 matching promo available for new GBP listings. Raise with Nate once Phase 1 shows results.',
   'Client Work', 'todo', 'low',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Build standalone Harvey''s website (Phase 2)',
   'Core 30 site build. Trigger: after Phase 1 delivers measurable ranking improvement. Standalone site bypasses Lightspeed constraint, establishes Harvey''s as independent brand. Candidate for standard paid engagement.',
   'Client Work', 'todo', 'low',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Fix mobile performance on banburygolf.com (Phase 2)',
   'Current LCP: 11.5s. Target: under 3s. Blocked same as schema — Lightspeed controls stack. May be moot if standalone site is built.',
   'Client Work', 'todo', 'low',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1)),

  ('Citation campaign: Apple Maps, Bing, trust signals (Phase 2)',
   'Add trust signal citations. Raise with Nate in Phase 2 conversation.',
   'Client Work', 'todo', 'low',
   (SELECT id FROM public.wpa_clients WHERE name = 'Harvey''s at BanBury' LIMIT 1));
