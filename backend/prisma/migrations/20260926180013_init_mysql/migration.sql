-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `dob` DATETIME(3) NULL,
    `college` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `joiningDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `role` ENUM('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE') NOT NULL DEFAULT 'INTERN',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `profilePic` VARCHAR(191) NULL,
    `candidateType` VARCHAR(191) NULL,
    `resume` VARCHAR(191) NULL,
    `degree` VARCHAR(191) NULL,
    `currentYearSemester` VARCHAR(191) NULL,
    `graduationYear` VARCHAR(191) NULL,
    `internshipRole` VARCHAR(191) NULL,
    `internshipDuration` VARCHAR(191) NULL,
    `highestQualification` VARCHAR(191) NULL,
    `keySkills` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `totalExperience` VARCHAR(191) NULL,
    `notificationPreferences` JSON NULL,
    `customData` JSON NULL,
    `casualLeaveQuota` INTEGER NOT NULL DEFAULT 12,
    `sickLeaveQuota` INTEGER NOT NULL DEFAULT 12,
    `emergencyLeaveQuota` INTEGER NOT NULL DEFAULT 6,
    `resetOtpHash` VARCHAR(191) NULL,
    `resetOtpExpiry` DATETIME(3) NULL,
    `resetOtpAttempts` INTEGER NOT NULL DEFAULT 0,
    `lastOtpSentAt` DATETIME(3) NULL,
    `resetTokenHash` VARCHAR(191) NULL,
    `resetTokenExpiry` DATETIME(3) NULL,
    `otpHourlyCount` INTEGER NOT NULL DEFAULT 0,
    `otpHourlyWindowStart` DATETIME(3) NULL,
    `welcomePopupSeen` BOOLEAN NOT NULL DEFAULT false,
    `organizationId` VARCHAR(191) NULL,
    `positionId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `designationId` VARCHAR(191) NULL,
    `reportingManagerId` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `shiftId` VARCHAR(191) NULL,
    `employmentType` VARCHAR(191) NULL,
    `probationPeriod` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `jobLevel` VARCHAR(191) NULL,
    `costCenter` VARCHAR(191) NULL,
    `businessUnit` VARCHAR(191) NULL,
    `workLocation` VARCHAR(191) NULL,
    `promotionEligible` BOOLEAN NOT NULL DEFAULT false,
    `promotionDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_employeeId_key`(`employeeId`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Position` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `description` VARCHAR(191) NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#4F46E5',
    `textColor` VARCHAR(191) NOT NULL DEFAULT '#FFFFFF',
    `icon` VARCHAR(191) NOT NULL DEFAULT 'Award',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Position_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Position_organizationId_code_key`(`organizationId`, `code`),
    UNIQUE INDEX `Position_organizationId_name_key`(`organizationId`, `name`),
    UNIQUE INDEX `Position_organizationId_level_key`(`organizationId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PositionHistory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `oldPositionId` VARCHAR(191) NULL,
    `newPositionId` VARCHAR(191) NULL,
    `changedById` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromotionHistory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `previousRole` ENUM('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE') NOT NULL,
    `newRole` ENUM('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE') NOT NULL,
    `previousPositionId` VARCHAR(191) NULL,
    `newPositionId` VARCHAR(191) NULL,
    `previousEmployeeId` VARCHAR(191) NOT NULL,
    `newEmployeeId` VARCHAR(191) NOT NULL,
    `promotedById` VARCHAR(191) NULL,
    `promotionReason` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrgBranch` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL DEFAULT 'India',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Kolkata',
    `workingHoursRef` VARCHAR(191) NULL DEFAULT '09:00 - 18:00',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrgBranch_organizationId_idx`(`organizationId`),
    INDEX `OrgBranch_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DepartmentMaster` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DepartmentMaster_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `DepartmentMaster_organizationId_code_key`(`organizationId`, `code`),
    UNIQUE INDEX `DepartmentMaster_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DesignationMaster` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DesignationMaster_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `DesignationMaster_organizationId_code_key`(`organizationId`, `code`),
    UNIQUE INDEX `DesignationMaster_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftMaster` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL DEFAULT '09:30',
    `endTime` VARCHAR(191) NOT NULL DEFAULT '18:30',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShiftMaster_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmploymentTypeMaster` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmploymentTypeMaster_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `leaderId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Team_name_key`(`name`),
    INDEX `Team_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamMember` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TeamMember_teamId_userId_key`(`teamId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `clockIn` DATETIME(3) NULL,
    `clockOut` DATETIME(3) NULL,
    `clockInLocation` VARCHAR(191) NULL,
    `clockOutLocation` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `browser` VARCHAR(191) NULL,
    `device` VARCHAR(191) NULL,
    `workingHours` DOUBLE NULL,
    `status` ENUM('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'LEAVE', 'WORK_FROM_HOME', 'MISSED') NOT NULL DEFAULT 'PRESENT',
    `editedBy` VARCHAR(191) NULL,
    `lateMinutes` INTEGER NULL,
    `earlyWindowUsed` INTEGER NULL,
    `gracePeriodUsed` INTEGER NULL,
    `shiftStartUsed` VARCHAR(191) NULL,
    `workLocation` VARCHAR(191) NULL,
    `workLocationOther` VARCHAR(191) NULL,
    `shiftEndAt` DATETIME(3) NULL,
    `autoClockOut` BOOLEAN NOT NULL DEFAULT false,
    `clockOutReason` VARCHAR(191) NULL,
    `shiftId` VARCHAR(191) NULL,
    `shiftName` VARCHAR(191) NULL,
    `scheduledStartTime` VARCHAR(191) NULL,
    `scheduledEndTime` VARCHAR(191) NULL,

    UNIQUE INDEX `Attendance_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'WAITING_FOR_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `deadline` DATETIME(3) NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `assigneeId` VARCHAR(191) NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `attachments` JSON NULL,
    `type` VARCHAR(191) NULL DEFAULT 'TASK',
    `storyPoints` INTEGER NULL DEFAULT 0,
    `sprintName` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `milestoneId` VARCHAR(191) NULL,
    `estimatedHours` DOUBLE NULL DEFAULT 0,
    `actualHours` DOUBLE NULL DEFAULT 0,
    `approvalStatus` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `stageId` VARCHAR(191) NULL,
    `stageApprovalStatus` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `reviewStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `correctionText` TEXT NULL,
    `correctionAudioUrl` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `resubmittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `submitNotes` TEXT NULL,
    `files` JSON NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `audioUrl` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL DEFAULT 'TEXT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskReviewHistory` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `audioUrl` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskHistory` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('LAPTOP', 'DESKTOP', 'MONITOR', 'MOBILE', 'PHONE', 'ID_CARD', 'ACCESSORIES', 'KEYBOARD', 'MOUSE', 'HEADSET', 'TABLET', 'PRINTER', 'NETWORK', 'FURNITURE', 'OTHER') NOT NULL DEFAULT 'LAPTOP',
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `purchaseDate` DATETIME(3) NULL,
    `warrantyExpiry` DATETIME(3) NULL,
    `cost` DOUBLE NULL,
    `vendor` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `condition` VARCHAR(191) NULL DEFAULT 'EXCELLENT',
    `issueDate` DATETIME(3) NULL,
    `returnDate` DATETIME(3) NULL,
    `billPhoto` VARCHAR(191) NULL,
    `status` ENUM('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'LOST', 'DAMAGED', 'DISPOSED') NOT NULL DEFAULT 'AVAILABLE',
    `description` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `assignedToId` VARCHAR(191) NULL,
    `assignedDate` DATETIME(3) NULL,
    `expectedReturn` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Asset_assetId_key`(`assetId`),
    UNIQUE INDEX `Asset_serialNumber_key`(`serialNumber`),
    INDEX `Asset_organizationId_idx`(`organizationId`),
    INDEX `Asset_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NULL,
    `assignedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedReturn` DATETIME(3) NULL,
    `returnDate` DATETIME(3) NULL,
    `conditionOnReturn` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `category` ENUM('TECHNICAL', 'PROJECT', 'HR', 'SOFTWARE', 'HARDWARE', 'GENERAL') NOT NULL,
    `status` ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `creatorId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `assetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Ticket_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `targetTeamId` VARCHAR(191) NULL,
    `targetUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `details` TEXT NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSettings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NOT NULL DEFAULT 'Innoveity',
    `senderEmail` VARCHAR(191) NOT NULL DEFAULT 'no-reply@innoveity.com',
    `internShiftStart` VARCHAR(191) NOT NULL DEFAULT '09:30',
    `internShiftEnd` VARCHAR(191) NOT NULL DEFAULT '18:30',
    `tlShiftStart` VARCHAR(191) NOT NULL DEFAULT '09:30',
    `tlShiftEnd` VARCHAR(191) NOT NULL DEFAULT '18:30',
    `officeLatitude` DOUBLE NOT NULL DEFAULT 12.971598,
    `officeLongitude` DOUBLE NOT NULL DEFAULT 77.594562,
    `allowedRadiusMeters` DOUBLE NOT NULL DEFAULT 200.0,
    `officeLocationName` VARCHAR(191) NOT NULL DEFAULT 'Innoveity Headquarters',
    `earlyWindowMinutes` INTEGER NOT NULL DEFAULT 30,
    `gracePeriodMinutes` INTEGER NOT NULL DEFAULT 15,
    `clockInTime` VARCHAR(191) NOT NULL DEFAULT '09:00',
    `clockOutTime` VARCHAR(191) NOT NULL DEFAULT '18:00',
    `autoClockOutEnabled` BOOLEAN NOT NULL DEFAULT true,
    `latePolicyEnabled` BOOLEAN NOT NULL DEFAULT true,
    `warningLateLimit` INTEGER NOT NULL DEFAULT 3,
    `deductionPerLate` VARCHAR(191) NOT NULL DEFAULT '1_DAY_SALARY',
    `latePolicyAppliesTo` VARCHAR(191) NOT NULL DEFAULT 'INTERN,EMPLOYEE,TEAM_LEADER',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemSettings_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlatformSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'PLATFORM',
    `companyName` VARCHAR(191) NOT NULL DEFAULT 'Innoviety Enterprise',
    `companyLogo` VARCHAR(191) NULL,
    `selectedTheme` VARCHAR(191) NOT NULL DEFAULT 'emerald',
    `themeMode` VARCHAR(191) NOT NULL DEFAULT 'light',
    `chatEnabledForAdmins` BOOLEAN NOT NULL DEFAULT true,
    `chatEnabledForUsers` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subtask` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `isDone` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Repository` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Passing',
    `lang` VARCHAR(191) NOT NULL DEFAULT 'React/JS',
    `commitsCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Repository_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `totalDays` DOUBLE NOT NULL DEFAULT 1.0,
    `leaveType` VARCHAR(191) NOT NULL DEFAULT 'CASUAL',
    `type` VARCHAR(191) NOT NULL DEFAULT 'LEAVE',
    `payType` VARCHAR(191) NOT NULL DEFAULT 'PAID',
    `subject` VARCHAR(191) NULL,
    `letterContent` TEXT NULL,
    `reason` TEXT NOT NULL,
    `contactPhone` VARCHAR(191) NULL,
    `submittedTeamId` VARCHAR(191) NULL,
    `submittedTeamLeaderId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_TL_APPROVAL',
    `tlApprovalStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `tlApprovedById` VARCHAR(191) NULL,
    `tlApprovedAt` DATETIME(3) NULL,
    `tlRemarks` VARCHAR(191) NULL,
    `adminApprovalStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `adminApprovedById` VARCHAR(191) NULL,
    `adminApprovedAt` DATETIME(3) NULL,
    `adminRemarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeavePolicy` (
    `id` VARCHAR(191) NOT NULL,
    `isGlobal` BOOLEAN NOT NULL DEFAULT true,
    `allocationType` ENUM('ANNUAL', 'MONTHLY') NOT NULL DEFAULT 'ANNUAL',
    `carryForwardEnabled` BOOLEAN NOT NULL DEFAULT true,
    `maxCarryForwardDays` DOUBLE NOT NULL DEFAULT 5.0,
    `halfDayAllowed` BOOLEAN NOT NULL DEFAULT true,
    `workingDaysOnly` BOOLEAN NOT NULL DEFAULT true,
    `autoApproval` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveType` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#3B82F6',
    `icon` VARCHAR(191) NOT NULL DEFAULT 'Calendar',
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isPaid` BOOLEAN NOT NULL DEFAULT true,
    `annualDays` DOUBLE NOT NULL DEFAULT 12.0,
    `monthlyCreditDays` DOUBLE NOT NULL DEFAULT 1.0,
    `allowCarryForward` BOOLEAN NOT NULL DEFAULT false,
    `requireDoc` BOOLEAN NOT NULL DEFAULT false,
    `allowHalfDay` BOOLEAN NOT NULL DEFAULT true,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeaveType_name_key`(`name`),
    UNIQUE INDEX `LeaveType_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserLeaveBalance` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `leaveTypeId` VARCHAR(191) NOT NULL,
    `allocated` DOUBLE NOT NULL DEFAULT 0.0,
    `used` DOUBLE NOT NULL DEFAULT 0.0,
    `pending` DOUBLE NOT NULL DEFAULT 0.0,
    `available` DOUBLE NOT NULL DEFAULT 0.0,
    `carryForward` DOUBLE NOT NULL DEFAULT 0.0,
    `expired` DOUBLE NOT NULL DEFAULT 0.0,
    `lastCreditedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserLeaveBalance_userId_leaveTypeId_key`(`userId`, `leaveTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveCreditHistory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `leaveTypeId` VARCHAR(191) NOT NULL,
    `creditedDays` DOUBLE NOT NULL,
    `creditedOn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `LeaveCreditHistory_userId_leaveTypeId_month_year_key`(`userId`, `leaveTypeId`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Branch` (
    `id` VARCHAR(191) NOT NULL,
    `repoId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Branch_repoId_name_key`(`repoId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatRoom` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `type` ENUM('GLOBAL', 'COMPANY', 'TEAM', 'PROJECT', 'DIRECT') NOT NULL DEFAULT 'DIRECT',
    `organizationId` VARCHAR(191) NULL,
    `teamId` VARCHAR(191) NULL,
    `taskId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `lastMessageId` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChatRoom_projectId_key`(`projectId`),
    INDEX `ChatRoom_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `projectCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('CLIENT', 'INTERNAL', 'MAINTENANCE', 'RND', 'TRAINING') NOT NULL DEFAULT 'CLIENT',
    `status` ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `estimatedStartDate` DATETIME(3) NOT NULL,
    `estimatedEndDate` DATETIME(3) NOT NULL,
    `actualStartDate` DATETIME(3) NULL,
    `actualEndDate` DATETIME(3) NULL,
    `teamId` VARCHAR(191) NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `leaderId` VARCHAR(191) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `deletedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Project_projectCode_key`(`projectCode`),
    INDEX `Project_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMember` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('PROJECT_LEADER', 'TEAM_LEADER', 'MEMBER', 'OBSERVER') NOT NULL DEFAULT 'MEMBER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProjectMember_projectId_userId_key`(`projectId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMilestone` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskDependency` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `dependsOnTaskId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaskDependency_taskId_dependsOnTaskId_key`(`taskId`, `dependsOnTaskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkLog` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `taskId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `hoursWorked` DOUBLE NOT NULL,
    `workDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
    `submittedAt` DATETIME(3) NULL,
    `isDraft` BOOLEAN NOT NULL DEFAULT false,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkLogAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `workLogId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIFeedback` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `recommendationId` VARCHAR(191) NOT NULL,
    `rating` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `feedbackText` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectDocument` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `uploaderId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectHistory` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldStatus` ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED') NULL,
    `newStatus` ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED') NULL,
    `detail` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatRoomMember` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatRoomMember_roomId_userId_key`(`roomId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `messageType` ENUM('TEXT', 'FILE', 'IMAGE') NOT NULL DEFAULT 'TEXT',
    `attachmentUrl` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `replyToMessageId` VARCHAR(191) NULL,
    `isEdited` BOOLEAN NOT NULL DEFAULT false,
    `editedAt` DATETIME(3) NULL,
    `editedBy` VARCHAR(191) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `deletedForUsers` VARCHAR(191) NULL,
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `pinnedAt` DATETIME(3) NULL,
    `pinnedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageRead` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MessageRead_messageId_userId_key`(`messageId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomFormField` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` ENUM('USER_PROFILE', 'INTERN_PROFILE', 'EMPLOYEE_PROFILE', 'TEAM_LEADER_PROFILE', 'ADMIN_PROFILE', 'REGISTRATION', 'PROJECT', 'TASK', 'ATTENDANCE', 'LEAVE', 'HELPDESK', 'ANNOUNCEMENT', 'ASSET', 'WORKLOG', 'TEAM', 'CLIENT') NOT NULL,
    `fieldKey` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `placeholder` VARCHAR(191) NULL,
    `fieldType` ENUM('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'TIME', 'DATETIME', 'DROPDOWN', 'MULTISELECT', 'CHECKBOX', 'RADIO', 'FILE', 'IMAGE', 'URL', 'PASSWORD', 'COLOR', 'RATING', 'SWITCH') NOT NULL DEFAULT 'TEXT',
    `options` JSON NULL,
    `visibleTo` JSON NOT NULL,
    `editableBy` JSON NOT NULL,
    `requiredFor` JSON NOT NULL,
    `minLength` INTEGER NULL,
    `maxLength` INTEGER NULL,
    `minVal` DOUBLE NULL,
    `maxVal` DOUBLE NULL,
    `regexPattern` VARCHAR(191) NULL,
    `defaultValue` VARCHAR(191) NULL,
    `isUnique` BOOLEAN NOT NULL DEFAULT false,
    `isReadOnly` BOOLEAN NOT NULL DEFAULT false,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `isDisabled` BOOLEAN NOT NULL DEFAULT false,
    `dependsOnField` VARCHAR(191) NULL,
    `dependsOnOperator` VARCHAR(191) NULL,
    `dependsOnValue` VARCHAR(191) NULL,
    `isSystemDefault` BOOLEAN NOT NULL DEFAULT false,
    `order` INTEGER NOT NULL DEFAULT 0,
    `versionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomFormField_entityType_fieldKey_versionId_key`(`entityType`, `fieldKey`, `versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomFormVersion` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` ENUM('USER_PROFILE', 'INTERN_PROFILE', 'EMPLOYEE_PROFILE', 'TEAM_LEADER_PROFILE', 'ADMIN_PROFILE', 'REGISTRATION', 'PROJECT', 'TASK', 'ATTENDANCE', 'LEAVE', 'HELPDESK', 'ANNOUNCEMENT', 'ASSET', 'WORKLOG', 'TEAM', 'CLIENT') NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomFormVersion_entityType_version_key`(`entityType`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DynamicMenu` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE') NOT NULL,
    `menuKey` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `route` VARCHAR(191) NOT NULL,
    `permission` VARCHAR(191) NULL,
    `badge` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DynamicMenu_role_menuKey_key`(`role`, `menuKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BuilderHistory` (
    `id` VARCHAR(191) NOT NULL,
    `performedById` VARCHAR(191) NOT NULL,
    `builderType` VARCHAR(191) NOT NULL,
    `entityType` ENUM('USER_PROFILE', 'INTERN_PROFILE', 'EMPLOYEE_PROFILE', 'TEAM_LEADER_PROFILE', 'ADMIN_PROFILE', 'REGISTRATION', 'PROJECT', 'TASK', 'ATTENDANCE', 'LEAVE', 'HELPDESK', 'ANNOUNCEMENT', 'ASSET', 'WORKLOG', 'TEAM', 'CLIENT') NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldSnapshot` JSON NULL,
    `newSnapshot` JSON NULL,
    `details` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `targetRole` ENUM('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `basicSalary` DOUBLE NOT NULL DEFAULT 0,
    `hra` DOUBLE NOT NULL DEFAULT 0,
    `da` DOUBLE NOT NULL DEFAULT 0,
    `specialAllowance` DOUBLE NOT NULL DEFAULT 0,
    `travelAllowance` DOUBLE NOT NULL DEFAULT 0,
    `medicalAllowance` DOUBLE NOT NULL DEFAULT 0,
    `otherAllowances` DOUBLE NOT NULL DEFAULT 0,
    `bonus` DOUBLE NOT NULL DEFAULT 0,
    `pfRatePercent` DOUBLE NOT NULL DEFAULT 12.0,
    `esiRatePercent` DOUBLE NOT NULL DEFAULT 0.75,
    `profTax` DOUBLE NOT NULL DEFAULT 200.0,
    `incomeTaxPercent` DOUBLE NOT NULL DEFAULT 5.0,
    `otherDeductions` DOUBLE NOT NULL DEFAULT 0,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SalaryTemplate_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryStructure` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `basicSalary` DOUBLE NOT NULL DEFAULT 0,
    `hra` DOUBLE NOT NULL DEFAULT 0,
    `da` DOUBLE NOT NULL DEFAULT 0,
    `specialAllowance` DOUBLE NOT NULL DEFAULT 0,
    `travelAllowance` DOUBLE NOT NULL DEFAULT 0,
    `medicalAllowance` DOUBLE NOT NULL DEFAULT 0,
    `otherAllowances` DOUBLE NOT NULL DEFAULT 0,
    `bonus` DOUBLE NOT NULL DEFAULT 0,
    `pfDeduction` DOUBLE NOT NULL DEFAULT 0,
    `esiDeduction` DOUBLE NOT NULL DEFAULT 0,
    `profTax` DOUBLE NOT NULL DEFAULT 200.0,
    `incomeTax` DOUBLE NOT NULL DEFAULT 0,
    `otherDeductions` DOUBLE NOT NULL DEFAULT 0,
    `grossSalary` DOUBLE NOT NULL DEFAULT 0,
    `netSalary` DOUBLE NOT NULL DEFAULT 0,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalaryStructure_userId_key`(`userId`),
    INDEX `SalaryStructure_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryRevision` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `previousSalary` DOUBLE NOT NULL,
    `newSalary` DOUBLE NOT NULL,
    `revisionType` VARCHAR(191) NOT NULL,
    `changeAmount` DOUBLE NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` VARCHAR(191) NOT NULL,
    `revisedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SalaryRevision_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HolidayCalendar` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `type` ENUM('NATIONAL', 'COMPANY', 'WEEKEND') NOT NULL DEFAULT 'COMPANY',
    `isWorkingHoliday` BOOLEAN NOT NULL DEFAULT false,
    `payMultiplier` DOUBLE NOT NULL DEFAULT 2.0,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HolidayCalendar_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `HolidayCalendar_organizationId_date_key`(`organizationId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollSettings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `cycleStartDay` INTEGER NOT NULL DEFAULT 1,
    `payDay` INTEGER NOT NULL DEFAULT 30,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `overtimeHourlyRate` DOUBLE NOT NULL DEFAULT 150.0,
    `holidayPayMultiplier` DOUBLE NOT NULL DEFAULT 2.0,
    `weekendPayMultiplier` DOUBLE NOT NULL DEFAULT 1.5,
    `lateDeductionRule` VARCHAR(191) NOT NULL DEFAULT 'FLAT_RATE',
    `lateDeductionRate` DOUBLE NOT NULL DEFAULT 100.0,
    `halfDayDeductionRate` DOUBLE NOT NULL DEFAULT 0.5,
    `minimumWorkingHours` DOUBLE NOT NULL DEFAULT 4.0,
    `roundingRule` VARCHAR(191) NOT NULL DEFAULT 'ROUND_HALF_UP',
    `payslipTemplate` VARCHAR(191) NOT NULL DEFAULT 'STANDARD',
    `companyName` VARCHAR(191) NOT NULL DEFAULT 'Innoveity',
    `companyLogo` VARCHAR(191) NULL,
    `companyAddress` VARCHAR(191) NOT NULL DEFAULT '100 Innovation Towers, Cyber City, Bangalore - 560001',
    `authorizedSignature` VARCHAR(191) NOT NULL DEFAULT 'Authorized HR Signatory',
    `latePolicyEnabled` BOOLEAN NOT NULL DEFAULT true,
    `warningLateLimit` INTEGER NOT NULL DEFAULT 3,
    `deductionPerLate` VARCHAR(191) NOT NULL DEFAULT '1_DAY_SALARY',
    `latePolicyAppliesTo` VARCHAR(191) NOT NULL DEFAULT 'INTERN,EMPLOYEE,TEAM_LEADER',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PayrollSettings_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollBatch` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PREVIEW', 'LOCKED', 'REVIEW', 'PUBLISHED', 'COMPLETED', 'ROLLED_BACK') NOT NULL DEFAULT 'DRAFT',
    `totalEmployees` INTEGER NOT NULL DEFAULT 0,
    `totalGross` DOUBLE NOT NULL DEFAULT 0,
    `totalDeductions` DOUBLE NOT NULL DEFAULT 0,
    `totalNet` DOUBLE NOT NULL DEFAULT 0,
    `processedById` VARCHAR(191) NOT NULL,
    `lockedAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayrollBatch_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `PayrollBatch_month_year_organizationId_key`(`month`, `year`, `organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payslip` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `basicSalary` DOUBLE NOT NULL DEFAULT 0,
    `hra` DOUBLE NOT NULL DEFAULT 0,
    `da` DOUBLE NOT NULL DEFAULT 0,
    `allowancesJson` JSON NULL,
    `deductionsJson` JSON NULL,
    `grossSalary` DOUBLE NOT NULL DEFAULT 0,
    `netSalary` DOUBLE NOT NULL DEFAULT 0,
    `workingDays` INTEGER NOT NULL DEFAULT 30,
    `presentDays` DOUBLE NOT NULL DEFAULT 0,
    `paidLeaveDays` DOUBLE NOT NULL DEFAULT 0,
    `unpaidAbsentDays` DOUBLE NOT NULL DEFAULT 0,
    `wfhDays` DOUBLE NOT NULL DEFAULT 0,
    `overtimeHours` DOUBLE NOT NULL DEFAULT 0,
    `overtimePay` DOUBLE NOT NULL DEFAULT 0,
    `holidayDaysWorked` DOUBLE NOT NULL DEFAULT 0,
    `holidayPay` DOUBLE NOT NULL DEFAULT 0,
    `lateDeduction` DOUBLE NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PREVIEW', 'LOCKED', 'REVIEW', 'PUBLISHED', 'COMPLETED', 'ROLLED_BACK') NOT NULL DEFAULT 'DRAFT',
    `qrCodeHash` VARCHAR(191) NULL,
    `pdfPath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payslip_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Payslip_batchId_userId_key`(`batchId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectWorkflowStage` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#6366F1',
    `order` INTEGER NOT NULL DEFAULT 0,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `approverRole` VARCHAR(191) NULL,
    `approverId` VARCHAR(191) NULL,
    `isCompletedStage` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectWorkflowStage_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskStageApprovalAudit` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `status` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `comment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkCalendar` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `date` DATE NULL,
    `status` ENUM('WORKING_DAY', 'WFH', 'HOLIDAY') NOT NULL,
    `title` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `isPermanent` BOOLEAN NOT NULL DEFAULT false,
    `recurrenceMonth` INTEGER NULL,
    `recurrenceDay` INTEGER NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkCalendar_date_idx`(`date`),
    INDEX `WorkCalendar_organizationId_idx`(`organizationId`),
    INDEX `WorkCalendar_isPermanent_recurrenceMonth_recurrenceDay_idx`(`isPermanent`, `recurrenceMonth`, `recurrenceDay`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL DEFAULT 'GENERAL',
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `details` JSON NULL,
    `performedById` VARCHAR(191) NULL,
    `targetUserId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrganizationAuditLog_organizationId_idx`(`organizationId`),
    INDEX `OrganizationAuditLog_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `OrganizationAuditLog_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `companyCode` VARCHAR(191) NOT NULL,
    `logo` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Kolkata',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `subscriptionPlanId` VARCHAR(191) NULL,
    `subscriptionStatus` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `storageUsedMB` INTEGER NOT NULL DEFAULT 0,
    `maintenanceMode` BOOLEAN NOT NULL DEFAULT false,
    `maintenanceMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organization_slug_key`(`slug`),
    UNIQUE INDEX `Organization_companyCode_key`(`companyCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationSettings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `branding` JSON NULL,
    `theme` JSON NULL,
    `workingDays` JSON NULL,
    `holidays` JSON NULL,
    `wfhSettings` JSON NULL,
    `leavePolicy` JSON NULL,
    `chatEnabledForAdmins` BOOLEAN NOT NULL DEFAULT true,
    `chatEnabledForUsers` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrganizationSettings_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionPlan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `maxUsers` INTEGER NOT NULL DEFAULT 25,
    `maxProjects` INTEGER NOT NULL DEFAULT 10,
    `maxStorageGB` INTEGER NOT NULL DEFAULT 5,
    `maxAdmins` INTEGER NOT NULL DEFAULT 2,
    `features` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SubscriptionPlan_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shift` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `workingDays` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Shift_organizationId_idx`(`organizationId`),
    INDEX `Shift_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftMember` (
    `id` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ShiftMember_userId_key`(`userId`),
    INDEX `ShiftMember_shiftId_idx`(`shiftId`),
    INDEX `ShiftMember_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftHistory` (
    `id` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `details` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShiftHistory_shiftId_idx`(`shiftId`),
    INDEX `ShiftHistory_shiftId_createdAt_idx`(`shiftId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `reason` VARCHAR(191) NULL,
    `swapWithUserId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShiftSchedule_organizationId_idx`(`organizationId`),
    INDEX `ShiftSchedule_userId_startDate_endDate_idx`(`userId`, `startDate`, `endDate`),
    INDEX `ShiftSchedule_organizationId_startDate_endDate_idx`(`organizationId`, `startDate`, `endDate`),
    INDEX `ShiftSchedule_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftNotification` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShiftNotification_organizationId_idx`(`organizationId`),
    INDEX `ShiftNotification_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `ShiftNotification_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftApproval` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `requestType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_TL_APPROVAL',
    `reason` VARCHAR(191) NULL,
    `details` JSON NULL,
    `adminNote` VARCHAR(191) NULL,
    `tlNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShiftApproval_organizationId_idx`(`organizationId`),
    INDEX `ShiftApproval_requesterId_idx`(`requesterId`),
    INDEX `ShiftApproval_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecurringShiftTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `recurrencePattern` VARCHAR(191) NOT NULL,
    `config` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RecurringShiftTemplate_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftAutomationSetting` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `shiftReminder1h` BOOLEAN NOT NULL DEFAULT true,
    `tomorrowReminder` BOOLEAN NOT NULL DEFAULT true,
    `overrideApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
    `swapApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
    `weekendApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
    `holidayApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
    `lateAlert` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShiftAutomationSetting_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftException` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `resolutionNote` VARCHAR(191) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShiftException_organizationId_idx`(`organizationId`),
    INDEX `ShiftException_userId_date_idx`(`userId`, `date`),
    INDEX `ShiftException_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkforceInsight` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL DEFAULT 'GENERAL',
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'INFO',
    `metadata` JSON NULL,
    `isDismissed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkforceInsight_organizationId_idx`(`organizationId`),
    INDEX `WorkforceInsight_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Visitor` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `hostId` VARCHAR(191) NOT NULL,
    `visitorName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `qrCode` VARCHAR(191) NOT NULL,
    `badgeNumber` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_APPROVAL',
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `checkIn` DATETIME(3) NULL,
    `checkOut` DATETIME(3) NULL,
    `branchId` VARCHAR(191) NULL,
    `idProofType` VARCHAR(191) NULL,
    `idProofNumber` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Visitor_qrCode_key`(`qrCode`),
    INDEX `Visitor_organizationId_idx`(`organizationId`),
    INDEX `Visitor_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Visitor_hostId_idx`(`hostId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeDocument` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'VERIFIED',
    `notes` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeDocument_organizationId_idx`(`organizationId`),
    INDEX `EmployeeDocument_userId_idx`(`userId`),
    INDEX `EmployeeDocument_documentType_idx`(`documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeDocumentHistory` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `changeNotes` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmployeeDocumentHistory_documentId_idx`(`documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NULL,
    `isAllDay` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrganizationEvent_organizationId_idx`(`organizationId`),
    INDEX `OrganizationEvent_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExternalIntegration` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DISCONNECTED',
    `authType` VARCHAR(191) NOT NULL DEFAULT 'OAUTH2',
    `clientId` VARCHAR(191) NULL,
    `clientSecret` VARCHAR(191) NULL,
    `accessToken` VARCHAR(191) NULL,
    `refreshToken` VARCHAR(191) NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `webhookUrl` VARCHAR(191) NULL,
    `settings` JSON NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `lastSyncStatus` VARCHAR(191) NULL DEFAULT 'IDLE',
    `errorMessage` VARCHAR(191) NULL,
    `connectedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExternalIntegration_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `ExternalIntegration_organizationId_provider_key`(`organizationId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `OrgBranch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `DepartmentMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `DesignationMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `ShiftMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Position` ADD CONSTRAINT `Position_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionHistory` ADD CONSTRAINT `PositionHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionHistory` ADD CONSTRAINT `PositionHistory_oldPositionId_fkey` FOREIGN KEY (`oldPositionId`) REFERENCES `Position`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionHistory` ADD CONSTRAINT `PositionHistory_newPositionId_fkey` FOREIGN KEY (`newPositionId`) REFERENCES `Position`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PositionHistory` ADD CONSTRAINT `PositionHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromotionHistory` ADD CONSTRAINT `PromotionHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromotionHistory` ADD CONSTRAINT `PromotionHistory_previousPositionId_fkey` FOREIGN KEY (`previousPositionId`) REFERENCES `Position`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromotionHistory` ADD CONSTRAINT `PromotionHistory_newPositionId_fkey` FOREIGN KEY (`newPositionId`) REFERENCES `Position`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromotionHistory` ADD CONSTRAINT `PromotionHistory_promotedById_fkey` FOREIGN KEY (`promotedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrgBranch` ADD CONSTRAINT `OrgBranch_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartmentMaster` ADD CONSTRAINT `DepartmentMaster_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DesignationMaster` ADD CONSTRAINT `DesignationMaster_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DesignationMaster` ADD CONSTRAINT `DesignationMaster_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `DepartmentMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Team` ADD CONSTRAINT `Team_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Team` ADD CONSTRAINT `Team_leaderId_fkey` FOREIGN KEY (`leaderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `ProjectMilestone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `ProjectWorkflowStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskSubmission` ADD CONSTRAINT `TaskSubmission_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskSubmission` ADD CONSTRAINT `TaskSubmission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskReviewHistory` ADD CONSTRAINT `TaskReviewHistory_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskReviewHistory` ADD CONSTRAINT `TaskReviewHistory_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskHistory` ADD CONSTRAINT `TaskHistory_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `OrgBranch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_targetTeamId_fkey` FOREIGN KEY (`targetTeamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemSettings` ADD CONSTRAINT `SystemSettings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subtask` ADD CONSTRAINT `Subtask_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserLeaveBalance` ADD CONSTRAINT `UserLeaveBalance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserLeaveBalance` ADD CONSTRAINT `UserLeaveBalance_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `LeaveType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveCreditHistory` ADD CONSTRAINT `LeaveCreditHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveCreditHistory` ADD CONSTRAINT `LeaveCreditHistory_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `LeaveType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Branch` ADD CONSTRAINT `Branch_repoId_fkey` FOREIGN KEY (`repoId`) REFERENCES `Repository`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRoom` ADD CONSTRAINT `ChatRoom_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRoom` ADD CONSTRAINT `ChatRoom_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRoom` ADD CONSTRAINT `ChatRoom_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRoom` ADD CONSTRAINT `ChatRoom_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_leaderId_fkey` FOREIGN KEY (`leaderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMilestone` ADD CONSTRAINT `ProjectMilestone_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskDependency` ADD CONSTRAINT `TaskDependency_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskDependency` ADD CONSTRAINT `TaskDependency_dependsOnTaskId_fkey` FOREIGN KEY (`dependsOnTaskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLogAttachment` ADD CONSTRAINT `WorkLogAttachment_workLogId_fkey` FOREIGN KEY (`workLogId`) REFERENCES `WorkLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIFeedback` ADD CONSTRAINT `AIFeedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDocument` ADD CONSTRAINT `ProjectDocument_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDocument` ADD CONSTRAINT `ProjectDocument_uploaderId_fkey` FOREIGN KEY (`uploaderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectHistory` ADD CONSTRAINT `ProjectHistory_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectHistory` ADD CONSTRAINT `ProjectHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRoomMember` ADD CONSTRAINT `ChatRoomMember_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `ChatRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRoomMember` ADD CONSTRAINT `ChatRoomMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_replyToMessageId_fkey` FOREIGN KEY (`replyToMessageId`) REFERENCES `ChatMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `ChatRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageRead` ADD CONSTRAINT `MessageRead_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `ChatMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageRead` ADD CONSTRAINT `MessageRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomFormField` ADD CONSTRAINT `CustomFormField_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CustomFormVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomFormVersion` ADD CONSTRAINT `CustomFormVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DynamicMenu` ADD CONSTRAINT `DynamicMenu_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `DynamicMenu`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BuilderHistory` ADD CONSTRAINT `BuilderHistory_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryTemplate` ADD CONSTRAINT `SalaryTemplate_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryStructure` ADD CONSTRAINT `SalaryStructure_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryStructure` ADD CONSTRAINT `SalaryStructure_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryStructure` ADD CONSTRAINT `SalaryStructure_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `SalaryTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryRevision` ADD CONSTRAINT `SalaryRevision_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryRevision` ADD CONSTRAINT `SalaryRevision_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryRevision` ADD CONSTRAINT `SalaryRevision_revisedById_fkey` FOREIGN KEY (`revisedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HolidayCalendar` ADD CONSTRAINT `HolidayCalendar_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollSettings` ADD CONSTRAINT `PayrollSettings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollBatch` ADD CONSTRAINT `PayrollBatch_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollBatch` ADD CONSTRAINT `PayrollBatch_processedById_fkey` FOREIGN KEY (`processedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `PayrollBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectWorkflowStage` ADD CONSTRAINT `ProjectWorkflowStage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectWorkflowStage` ADD CONSTRAINT `ProjectWorkflowStage_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskStageApprovalAudit` ADD CONSTRAINT `TaskStageApprovalAudit_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskStageApprovalAudit` ADD CONSTRAINT `TaskStageApprovalAudit_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `ProjectWorkflowStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskStageApprovalAudit` ADD CONSTRAINT `TaskStageApprovalAudit_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskStageApprovalAudit` ADD CONSTRAINT `TaskStageApprovalAudit_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkCalendar` ADD CONSTRAINT `WorkCalendar_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkCalendar` ADD CONSTRAINT `WorkCalendar_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationAuditLog` ADD CONSTRAINT `OrganizationAuditLog_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationAuditLog` ADD CONSTRAINT `OrganizationAuditLog_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationAuditLog` ADD CONSTRAINT `OrganizationAuditLog_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Organization` ADD CONSTRAINT `Organization_subscriptionPlanId_fkey` FOREIGN KEY (`subscriptionPlanId`) REFERENCES `SubscriptionPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationSettings` ADD CONSTRAINT `OrganizationSettings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shift` ADD CONSTRAINT `Shift_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftMember` ADD CONSTRAINT `ShiftMember_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftMember` ADD CONSTRAINT `ShiftMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftHistory` ADD CONSTRAINT `ShiftHistory_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftHistory` ADD CONSTRAINT `ShiftHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftSchedule` ADD CONSTRAINT `ShiftSchedule_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftSchedule` ADD CONSTRAINT `ShiftSchedule_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftSchedule` ADD CONSTRAINT `ShiftSchedule_swapWithUserId_fkey` FOREIGN KEY (`swapWithUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftSchedule` ADD CONSTRAINT `ShiftSchedule_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftSchedule` ADD CONSTRAINT `ShiftSchedule_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftNotification` ADD CONSTRAINT `ShiftNotification_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftNotification` ADD CONSTRAINT `ShiftNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftApproval` ADD CONSTRAINT `ShiftApproval_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftApproval` ADD CONSTRAINT `ShiftApproval_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftApproval` ADD CONSTRAINT `ShiftApproval_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringShiftTemplate` ADD CONSTRAINT `RecurringShiftTemplate_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringShiftTemplate` ADD CONSTRAINT `RecurringShiftTemplate_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftAutomationSetting` ADD CONSTRAINT `ShiftAutomationSetting_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftException` ADD CONSTRAINT `ShiftException_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftException` ADD CONSTRAINT `ShiftException_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftException` ADD CONSTRAINT `ShiftException_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkforceInsight` ADD CONSTRAINT `WorkforceInsight_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visitor` ADD CONSTRAINT `Visitor_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visitor` ADD CONSTRAINT `Visitor_hostId_fkey` FOREIGN KEY (`hostId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visitor` ADD CONSTRAINT `Visitor_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `OrgBranch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocument` ADD CONSTRAINT `EmployeeDocument_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocument` ADD CONSTRAINT `EmployeeDocument_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocument` ADD CONSTRAINT `EmployeeDocument_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDocumentHistory` ADD CONSTRAINT `EmployeeDocumentHistory_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `EmployeeDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationEvent` ADD CONSTRAINT `OrganizationEvent_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationEvent` ADD CONSTRAINT `OrganizationEvent_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `OrgBranch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalIntegration` ADD CONSTRAINT `ExternalIntegration_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalIntegration` ADD CONSTRAINT `ExternalIntegration_connectedById_fkey` FOREIGN KEY (`connectedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
