-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS training;

-- Use the newly created database
USE training;

-- Table for sites (tenants)
CREATE TABLE IF NOT EXISTS sites (
    id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY (name)
);

-- Table for users
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullName VARCHAR(255),
    department VARCHAR(255),
    position VARCHAR(255),
    role ENUM('Employee', 'Admin') NOT NULL DEFAULT 'Employee',
    type ENUM('Employee', 'External') NOT NULL DEFAULT 'Employee',
    email VARCHAR(255),
    phone VARCHAR(255),
    PRIMARY KEY (id),
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    UNIQUE KEY (site_id, username)
);

-- Table for courses
CREATE TABLE IF NOT EXISTS courses (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
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
    passing_rate INT,
    max_attempts INT,
    final_assessment_content JSON,
    PRIMARY KEY (id),
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Table for modules
CREATE TABLE IF NOT EXISTS modules (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    course_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    `order` INT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Table for lessons
CREATE TABLE IF NOT EXISTS lessons (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    module_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    type ENUM('video', 'document', 'quiz') NOT NULL,
    content TEXT,
    imagePath VARCHAR(255),
    documentPath VARCHAR(255),
    `order` INT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- Table for enrollments
CREATE TABLE IF NOT EXISTS enrollments (
    user_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    enrollment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Table for user progress
CREATE TABLE IF NOT EXISTS user_progress (
    user_id INT UNSIGNED NOT NULL,
    lesson_id INT UNSIGNED NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completion_date DATETIME,
    PRIMARY KEY (user_id, lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- Table for quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    lesson_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    score INT NOT NULL,
    total INT NOT NULL,
    attempt_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Table for final assessment attempts
CREATE TABLE IF NOT EXISTS final_assessment_attempts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    score INT NOT NULL,
    total INT NOT NULL,
    passed BOOLEAN NOT NULL,
    attempt_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Table for signatories
CREATE TABLE IF NOT EXISTS signatories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    signatureImagePath VARCHAR(255),
    PRIMARY KEY (id),
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Table for certificates
CREATE TABLE IF NOT EXISTS certificates (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED,
    completion_date DATETIME NOT NULL,
    certificate_number VARCHAR(255) UNIQUE,
    type ENUM('completion', 'recognition') NOT NULL DEFAULT 'completion',
    reason TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Junction table for certificate signatories
CREATE TABLE IF NOT EXISTS certificate_signatories (
    certificate_id INT UNSIGNED NOT NULL,
    signatory_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (certificate_id, signatory_id),
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE,
    FOREIGN KEY (signatory_id) REFERENCES signatories(id) ON DELETE CASCADE
);

-- Junction table for course signatories
CREATE TABLE IF NOT EXISTS course_signatories (
    course_id INT UNSIGNED NOT NULL,
    signatory_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (course_id, signatory_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (signatory_id) REFERENCES signatories(id) ON DELETE CASCADE
);

-- Table for payment transactions
CREATE TABLE IF NOT EXISTS transactions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'rejected') NOT NULL DEFAULT 'pending',
    gateway VARCHAR(255),
    gateway_transaction_id VARCHAR(255) UNIQUE,
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    proof_image_path VARCHAR(255),
    reference_number VARCHAR(255),
    rejection_reason TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Table for global application settings (per site)
CREATE TABLE IF NOT EXISTS app_settings (
    site_id VARCHAR(255) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    value TEXT,
    PRIMARY KEY (site_id, `key`),
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Insert core sites
INSERT IGNORE INTO sites (id, name) VALUES ('main', 'Skills Ascend Super Admin');
INSERT IGNORE INTO sites (id, name) VALUES ('branch-one', 'Branch One');
INSERT IGNORE INTO sites (id, name) VALUES ('branch-two', 'Branch Two');
INSERT IGNORE INTO sites (id, name) VALUES ('external', 'Public Users');

-- Insert super admin user
INSERT IGNORE INTO users (id, site_id, username, password, fullName, role, type) VALUES
(1, 'main', 'florante', '$2a$10$3zR1yA.9w4/IeJ2.p3vX..1s9.C8gB9G/N/gH4.gSgB6f2zE.gB0W', 'Florante Catapang', 'Admin', 'Employee');
