-- QAEHS Pro Academy - MySQL Schema
-- This script contains all the table definitions needed for the application.
-- It is designed for MySQL and can be used to set up your Google Cloud SQL database.

--
-- Table structure for table `sites`
--
CREATE TABLE IF NOT EXISTS `sites` (
  `id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Seeding core sites
--
INSERT IGNORE INTO `sites` (`id`, `name`) VALUES
('main', 'QAEHS Main Site'),
('branch-one', 'Branch One'),
('branch-two', 'Branch Two'),
('external', 'External Users');

--
-- Table structure for table `app_settings`
--
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `site_id` VARCHAR(255) NOT NULL,
  `key` VARCHAR(255) NOT NULL,
  `value` TEXT,
  UNIQUE KEY `site_id_key` (`site_id`, `key`),
  FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `users`
--
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `site_id` VARCHAR(255) NOT NULL,
  `username` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255),
  `fullName` VARCHAR(255),
  `department` VARCHAR(255),
  `position` VARCHAR(255),
  `role` ENUM('Employee', 'Admin') NOT NULL DEFAULT 'Employee',
  `type` ENUM('Employee', 'External') NOT NULL DEFAULT 'Employee',
  `email` VARCHAR(255),
  `phone` VARCHAR(255),
  UNIQUE KEY `site_id_username` (`site_id`, `username`),
  FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `courses`
--
CREATE TABLE IF NOT EXISTS `courses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `site_id` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(255),
  `imagePath` VARCHAR(255),
  `venue` VARCHAR(255),
  `startDate` DATETIME,
  `endDate` DATETIME,
  `is_internal` BOOLEAN DEFAULT TRUE,
  `is_public` BOOLEAN DEFAULT FALSE,
  `price` DECIMAL(10, 2),
  `passing_rate` INT,
  `max_attempts` INT,
  `final_assessment_content` TEXT,
  FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `modules`
--
CREATE TABLE IF NOT EXISTS `modules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `order` INT NOT NULL,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `lessons`
--
CREATE TABLE IF NOT EXISTS `lessons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `module_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `type` ENUM('video', 'document', 'quiz') NOT NULL,
  `content` TEXT,
  `imagePath` VARCHAR(255),
  `documentPath` VARCHAR(255),
  `order` INT NOT NULL,
  FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `enrollments`
--
CREATE TABLE IF NOT EXISTS `enrollments` (
  `user_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  PRIMARY KEY (`user_id`, `course_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `user_progress`
--
CREATE TABLE IF NOT EXISTS `user_progress` (
  `user_id` INT NOT NULL,
  `lesson_id` INT NOT NULL,
  `completed` BOOLEAN DEFAULT FALSE,
  `completion_date` DATETIME,
  PRIMARY KEY (`user_id`, `lesson_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `signatories`
--
CREATE TABLE IF NOT EXISTS `signatories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `site_id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `position` VARCHAR(255),
  `signatureImagePath` VARCHAR(255),
  FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `certificates`
--
CREATE TABLE IF NOT EXISTS `certificates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `course_id` INT,
  `completion_date` DATETIME NOT NULL,
  `certificate_number` VARCHAR(255) UNIQUE,
  `type` ENUM('completion', 'recognition') NOT NULL DEFAULT 'completion',
  `reason` TEXT,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `certificate_signatories`
--
CREATE TABLE IF NOT EXISTS `certificate_signatories` (
  `certificate_id` INT NOT NULL,
  `signatory_id` INT NOT NULL,
  PRIMARY KEY (`certificate_id`, `signatory_id`),
  FOREIGN KEY (`certificate_id`) REFERENCES `certificates`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`signatory_id`) REFERENCES `signatories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `course_signatories`
--
CREATE TABLE IF NOT EXISTS `course_signatories` (
  `course_id` INT NOT NULL,
  `signatory_id` INT NOT NULL,
  PRIMARY KEY (`course_id`, `signatory_id`),
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`signatory_id`) REFERENCES `signatories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `quiz_attempts`
--
CREATE TABLE IF NOT EXISTS `quiz_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `lesson_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `score` INT NOT NULL,
  `total` INT NOT NULL,
  `attempt_date` DATETIME NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `final_assessment_attempts`
--
CREATE TABLE IF NOT EXISTS `final_assessment_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `score` INT NOT NULL,
  `total` INT NOT NULL,
  `passed` BOOLEAN NOT NULL,
  `attempt_date` DATETIME NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `transactions`
--
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('pending', 'completed', 'failed', 'rejected') NOT NULL,
  `gateway` VARCHAR(255),
  `gateway_transaction_id` VARCHAR(255),
  `transaction_date` DATETIME NOT NULL,
  `proof_image_path` VARCHAR(255),
  `rejection_reason` TEXT,
  UNIQUE KEY `gateway_tx_id` (`gateway_transaction_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
