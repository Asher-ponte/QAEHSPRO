-- This script is designed for MySQL and is idempotent.
-- You can run it multiple times without causing errors.

-- Create the `sites` table first as it's referenced by many others.
CREATE TABLE IF NOT EXISTS sites (
    id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed core sites if they don't exist.
INSERT IGNORE INTO sites (id, name) VALUES 
('main', 'QAEHS Main Site'),
('branch-one', 'Branch One'),
('branch-two', 'Branch Two'),
('external', 'External Users');

-- Create the `users` table.
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    site_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    fullName VARCHAR(255),
    department VARCHAR(255),
    position VARCHAR(255),
    role ENUM('Employee', 'Admin') NOT NULL DEFAULT 'Employee',
    type ENUM('Employee', 'External') NOT NULL DEFAULT 'Employee',
    email VARCHAR(255),
    phone VARCHAR(255),
    UNIQUE KEY (site_id, username),
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `courses` table.
CREATE TABLE IF NOT EXISTS courses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    site_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(255),
    imagePath VARCHAR(255),
    venue VARCHAR(255),
    startDate DATETIME,
    endDate DATETIME,
    is_internal BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    price DECIMAL(10, 2),
    passing_rate INT UNSIGNED,
    max_attempts INT UNSIGNED,
    final_assessment_content JSON,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `modules` table.
CREATE TABLE IF NOT EXISTS modules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    `order` INT NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `lessons` table.
CREATE TABLE IF NOT EXISTS lessons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    module_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    type ENUM('video', 'document', 'quiz') NOT NULL,
    content TEXT,
    imagePath VARCHAR(255),
    documentPath VARCHAR(255),
    `order` INT NOT NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `enrollments` table.
CREATE TABLE IF NOT EXISTS enrollments (
    user_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `user_progress` table.
CREATE TABLE IF NOT EXISTS user_progress (
    user_id INT UNSIGNED NOT NULL,
    lesson_id INT UNSIGNED NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `certificates` table.
CREATE TABLE IF NOT EXISTS certificates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED,
    completion_date DATETIME NOT NULL,
    certificate_number VARCHAR(255) UNIQUE,
    type ENUM('completion', 'recognition') NOT NULL,
    reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `signatories` table.
CREATE TABLE IF NOT EXISTS signatories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    site_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    signatureImagePath VARCHAR(255) NOT NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `certificate_signatories` join table.
CREATE TABLE IF NOT EXISTS certificate_signatories (
    certificate_id INT UNSIGNED NOT NULL,
    signatory_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (certificate_id, signatory_id),
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE,
    FOREIGN KEY (signatory_id) REFERENCES signatories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `course_signatories` join table.
CREATE TABLE IF NOT EXISTS course_signatories (
    course_id INT UNSIGNED NOT NULL,
    signatory_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (course_id, signatory_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (signatory_id) REFERENCES signatories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `quiz_attempts` table.
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    lesson_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    score INT NOT NULL,
    total INT NOT NULL,
    attempt_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `final_assessment_attempts` table.
CREATE TABLE IF NOT EXISTS final_assessment_attempts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    score INT NOT NULL,
    total INT NOT NULL,
    passed BOOLEAN NOT NULL,
    attempt_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `transactions` table.
CREATE TABLE IF NOT EXISTS transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'rejected') NOT NULL,
    transaction_date DATETIME NOT NULL,
    gateway VARCHAR(255) NOT NULL,
    gateway_transaction_id VARCHAR(255) UNIQUE,
    proof_image_path VARCHAR(255),
    rejection_reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create the `app_settings` table.
CREATE TABLE IF NOT EXISTS app_settings (
    site_id VARCHAR(255) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `value` TEXT,
    PRIMARY KEY (site_id, `key`),
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
