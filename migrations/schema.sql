-- Create the database if it doesn't exist.
CREATE DATABASE IF NOT EXISTS safetysight;

-- Switch to the newly created database.
USE safetysight;

-- -----------------------------------------------------
-- Table `sites`
-- This table holds the different tenants/branches of the application.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sites` (
  `id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) VISIBLE
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `users`
-- Stores user accounts, scoped to a specific site.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `site_id` VARCHAR(255) NOT NULL,
  `username` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NULL,
  `fullName` VARCHAR(255) NULL,
  `department` VARCHAR(255) NULL,
  `position` VARCHAR(255) NULL,
  `role` ENUM('Employee', 'Admin') NOT NULL DEFAULT 'Employee',
  `type` ENUM('Employee', 'External') NOT NULL DEFAULT 'Employee',
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `site_username_UNIQUE` (`site_id` ASC, `username` ASC) VISIBLE,
  INDEX `fk_users_sites_idx` (`site_id` ASC) VISIBLE,
  CONSTRAINT `fk_users_sites`
    FOREIGN KEY (`site_id`)
    REFERENCES `sites` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `courses`
-- Stores course information, scoped to a specific site.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `courses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `site_id` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(255) NULL,
  `imagePath` VARCHAR(255) NULL,
  `venue` VARCHAR(255) NULL,
  `startDate` DATETIME NULL,
  `endDate` DATETIME NULL,
  `is_internal` TINYINT(1) NOT NULL DEFAULT 1,
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `price` DECIMAL(10, 2) NULL,
  `passing_rate` INT NULL,
  `max_attempts` INT NULL,
  `final_assessment_content` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_courses_sites_idx` (`site_id` ASC) VISIBLE,
  CONSTRAINT `fk_courses_sites`
    FOREIGN KEY (`site_id`)
    REFERENCES `sites` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `modules`
-- Stores modules for courses.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `modules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `order` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_modules_courses_idx` (`course_id` ASC) VISIBLE,
  CONSTRAINT `fk_modules_courses`
    FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `lessons`
-- Stores lessons within modules.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lessons` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `module_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `type` ENUM('video', 'document', 'quiz') NOT NULL,
  `content` TEXT NULL,
  `imagePath` VARCHAR(255) NULL,
  `documentPath` VARCHAR(255) NULL,
  `order` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_lessons_modules_idx` (`module_id` ASC) VISIBLE,
  CONSTRAINT `fk_lessons_modules`
    FOREIGN KEY (`module_id`)
    REFERENCES `modules` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `enrollments`
-- Junction table for user-course enrollments.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `enrollments` (
  `user_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`user_id`, `course_id`),
  INDEX `fk_enrollments_courses_idx` (`course_id` ASC) VISIBLE,
  INDEX `fk_enrollments_users_idx` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_enrollments_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_enrollments_courses`
    FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `user_progress`
-- Tracks user progress for each lesson.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_progress` (
  `user_id` INT UNSIGNED NOT NULL,
  `lesson_id` INT UNSIGNED NOT NULL,
  `completed` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`, `lesson_id`),
  INDEX `fk_user_progress_lessons_idx` (`lesson_id` ASC) VISIBLE,
  INDEX `fk_user_progress_users_idx` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_user_progress_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_progress_lessons`
    FOREIGN KEY (`lesson_id`)
    REFERENCES `lessons` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `certificates`
-- Stores generated certificates for users.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `certificates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NULL,
  `completion_date` DATETIME NOT NULL,
  `certificate_number` VARCHAR(255) NULL,
  `type` ENUM('completion', 'recognition') NOT NULL,
  `reason` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `certificate_number_UNIQUE` (`certificate_number` ASC) VISIBLE,
  INDEX `fk_certificates_users_idx` (`user_id` ASC) VISIBLE,
  INDEX `fk_certificates_courses_idx` (`course_id` ASC) VISIBLE,
  CONSTRAINT `fk_certificates_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_certificates_courses`
    FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`)
    ON DELETE SET NULL
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `signatories`
-- Stores signatories for certificates, scoped to a site.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `signatories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `site_id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `position` VARCHAR(255) NULL,
  `signatureImagePath` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_signatories_sites_idx` (`site_id` ASC) VISIBLE,
  CONSTRAINT `fk_signatories_sites`
    FOREIGN KEY (`site_id`)
    REFERENCES `sites` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `certificate_signatories`
-- Links certificates to signatories.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `certificate_signatories` (
  `certificate_id` INT UNSIGNED NOT NULL,
  `signatory_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`certificate_id`, `signatory_id`),
  INDEX `fk_cert_sig_signatories_idx` (`signatory_id` ASC) VISIBLE,
  INDEX `fk_cert_sig_certificates_idx` (`certificate_id` ASC) VISIBLE,
  CONSTRAINT `fk_cert_sig_certificates`
    FOREIGN KEY (`certificate_id`)
    REFERENCES `certificates` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_cert_sig_signatories`
    FOREIGN KEY (`signatory_id`)
    REFERENCES `signatories` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `course_signatories`
-- Default signatories for a course.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_signatories` (
  `course_id` INT UNSIGNED NOT NULL,
  `signatory_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`course_id`, `signatory_id`),
  INDEX `fk_course_sig_signatories_idx` (`signatory_id` ASC) VISIBLE,
  INDEX `fk_course_sig_courses_idx` (`course_id` ASC) VISIBLE,
  CONSTRAINT `fk_course_sig_courses`
    FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_course_sig_signatories`
    FOREIGN KEY (`signatory_id`)
    REFERENCES `signatories` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `app_settings`
-- Stores key-value settings, scoped to a site.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `app_settings` (
  `site_id` VARCHAR(255) NOT NULL,
  `key` VARCHAR(255) NOT NULL,
  `value` TEXT NULL,
  PRIMARY KEY (`site_id`, `key`),
  INDEX `fk_app_settings_sites_idx` (`site_id` ASC) VISIBLE,
  CONSTRAINT `fk_app_settings_sites`
    FOREIGN KEY (`site_id`)
    REFERENCES `sites` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `transactions`
-- For external user payments. Only uses the 'external' site.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('pending', 'completed', 'failed', 'rejected') NOT NULL,
  `gateway` VARCHAR(255) NULL,
  `gateway_transaction_id` VARCHAR(255) NULL,
  `transaction_date` DATETIME NOT NULL,
  `proof_image_path` VARCHAR(255) NULL,
  `rejection_reason` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_transactions_users_idx` (`user_id` ASC) VISIBLE,
  INDEX `fk_transactions_courses_idx` (`course_id` ASC) VISIBLE,
  UNIQUE INDEX `gateway_transaction_id_UNIQUE` (`gateway_transaction_id` ASC) VISIBLE,
  CONSTRAINT `fk_transactions_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_transactions_courses`
    FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `final_assessment_attempts`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `final_assessment_attempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `score` INT NOT NULL,
  `total` INT NOT NULL,
  `passed` TINYINT(1) NOT NULL,
  `attempt_date` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_faa_users_idx` (`user_id` ASC) VISIBLE,
  INDEX `fk_faa_courses_idx` (`course_id` ASC) VISIBLE,
  CONSTRAINT `fk_faa_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_faa_courses`
    FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `quiz_attempts`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `quiz_attempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `lesson_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `score` INT NOT NULL,
  `total` INT NOT NULL,
  `attempt_date` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_quiz_attempts_users_idx` (`user_id` ASC) VISIBLE,
  INDEX `fk_quiz_attempts_lessons_idx` (`lesson_id` ASC) VISIBLE,
  INDEX `fk_quiz_attempts_courses_idx` (`course_id` ASC) VISIBLE,
  CONSTRAINT `fk_quiz_attempts_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_quiz_attempts_lessons`
    FOREIGN KEY (`lesson_id`)
    REFERENCES `lessons` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_quiz_attempts_courses`
    FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION
) ENGINE = InnoDB;

-- ---
-- Seed initial data
-- ---
INSERT IGNORE INTO `sites` (`id`, `name`) VALUES
('main', 'QAEHS Main Site'),
('branch-one', 'Branch One'),
('branch-two', 'Branch Two'),
('external', 'External Users');
