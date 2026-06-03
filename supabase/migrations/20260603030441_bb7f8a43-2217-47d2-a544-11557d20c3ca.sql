-- Keep canonical three posting packages active; deactivate overlapping duplicates.
UPDATE public.packages SET active = false
WHERE kind = 'posting'
  AND id NOT IN (
    '27fcb3b2-e371-47e0-9ca3-f913f5d4c3cc', -- Single Post $99
    'e4e81d0a-e2f0-4db5-85e0-c8dd0848b583', -- 5-Pack $399
    'b550f28a-9a7d-4b73-9a8a-52997565955b'  -- Always-On $1299
  );

UPDATE public.packages SET sort_order = 0, active = true WHERE id = '27fcb3b2-e371-47e0-9ca3-f913f5d4c3cc';
UPDATE public.packages SET sort_order = 1, active = true WHERE id = 'e4e81d0a-e2f0-4db5-85e0-c8dd0848b583';
UPDATE public.packages SET sort_order = 2, active = true WHERE id = 'b550f28a-9a7d-4b73-9a8a-52997565955b';