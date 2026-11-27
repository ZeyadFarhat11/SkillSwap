-- CreateTable
CREATE TABLE `platform_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `platform_name` VARCHAR(80) NOT NULL DEFAULT 'SkillSwap',
    `platform_email` VARCHAR(255) NOT NULL DEFAULT 'support@skillswap.com',
    `platform_description` TEXT NOT NULL,
    `allow_registrations` BOOLEAN NOT NULL DEFAULT true,
    `require_email_verification` BOOLEAN NOT NULL DEFAULT false,
    `maintenance_mode` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
