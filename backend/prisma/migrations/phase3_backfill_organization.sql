-- Phase 3.1 Idempotent Backfill Migration: Set organizationId to INNOVEITY ID for all NULL records
DO $$
DECLARE
    innoveity_id TEXT;
BEGIN
    -- 1. Find INNOVEITY Organization ID
    SELECT id INTO innoveity_id FROM "Organization" WHERE slug = 'innoveity' OR "companyCode" = 'INN001' LIMIT 1;

    IF innoveity_id IS NULL THEN
        RAISE NOTICE 'INNOVEITY organization not found, skipping backfill.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found INNOVEITY Organization ID: %', innoveity_id;

    -- 2. Backfill Attendance
    UPDATE "Attendance" SET "organizationId" = innoveity_id WHERE "organizationId" IS NULL;

    -- 3. Backfill LeaveRequest
    UPDATE "LeaveRequest" SET "organizationId" = innoveity_id WHERE "organizationId" IS NULL;

    -- 4. Backfill WorkLog
    UPDATE "WorkLog" SET "organizationId" = innoveity_id WHERE "organizationId" IS NULL;

    -- 5. Backfill Project
    UPDATE "Project" SET "organizationId" = innoveity_id WHERE "organizationId" IS NULL;

    -- 6. Backfill Task
    UPDATE "Task" SET "organizationId" = innoveity_id WHERE "organizationId" IS NULL;

    -- 7. Backfill ChatRoom
    UPDATE "ChatRoom" SET "organizationId" = innoveity_id WHERE "organizationId" IS NULL;

    -- 8. Backfill ChatMessage
    UPDATE "ChatMessage" SET "organizationId" = innoveity_id WHERE "organizationId" IS NULL;

    -- 9. Backfill Notification
    UPDATE "Notification" SET "organizationId" = innoveity_id WHERE "organizationId" IS NULL;

    RAISE NOTICE 'Phase 3.1 Organization backfill completed successfully.';
END $$;
