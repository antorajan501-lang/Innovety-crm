-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sprintName" TEXT,
ADD COLUMN     "storyPoints" INTEGER DEFAULT 0,
ADD COLUMN     "type" TEXT DEFAULT 'TASK';

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'GLOBAL',
    "companyName" TEXT NOT NULL DEFAULT 'MRF Enterprise',
    "senderEmail" TEXT NOT NULL DEFAULT 'no-reply@mrf-enterprise.com',
    "internShiftStart" TEXT NOT NULL DEFAULT '09:30',
    "internShiftEnd" TEXT NOT NULL DEFAULT '18:30',
    "tlShiftStart" TEXT NOT NULL DEFAULT '09:30',
    "tlShiftEnd" TEXT NOT NULL DEFAULT '18:30',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
