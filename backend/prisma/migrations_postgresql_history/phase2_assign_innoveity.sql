-- Phase 2 Migration: Assign all users with NULL organizationId to default INNOVEITY organization
UPDATE "User"
SET "organizationId" = (SELECT id FROM "Organization" WHERE slug = 'innoveity' LIMIT 1)
WHERE "organizationId" IS NULL;
