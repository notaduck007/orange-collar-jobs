-- Ensure every company has a package, backfill orphan jobs, then enforce NOT NULL.

INSERT INTO company_packages (id, company_id, name, total_credits, used_credits)
SELECT gen_random_uuid(), c.id, 'Starter Pack', 500, 0
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM company_packages cp WHERE cp.company_id = c.id
);

WITH companies_ordered AS (
  SELECT
    c.id AS company_id,
    cp.id AS package_id,
    (ROW_NUMBER() OVER (ORDER BY c.name) - 1)::int AS idx
  FROM companies c
  INNER JOIN company_packages cp ON cp.company_id = c.id
  WHERE cp.id = (
    SELECT cp2.id
    FROM company_packages cp2
    WHERE cp2.company_id = c.id
    ORDER BY cp2.purchased_at ASC NULLS LAST, cp2.id ASC
    LIMIT 1
  )
),
jobs_needing AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (ORDER BY created_at, id) - 1)::int AS idx
  FROM jobs
  WHERE company_id IS NULL OR company_package_id IS NULL
),
company_count AS (
  SELECT COUNT(*)::int AS n FROM companies_ordered
)
UPDATE jobs j
SET
  company_id = co.company_id,
  company_package_id = co.package_id,
  updated_at = NOW()
FROM jobs_needing jn
CROSS JOIN company_count cc
INNER JOIN companies_ordered co ON (jn.idx % GREATEST(cc.n, 1)) = co.idx
WHERE j.id = jn.id;

ALTER TABLE "jobs" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "jobs" ALTER COLUMN "company_package_id" SET NOT NULL;
