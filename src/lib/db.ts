

'use server';

import { open, type Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

async function initializeDb() {
    // Dynamically import sqlite3 to ensure it's loaded in the correct environment.
    const sqlite3Driver = (await import('sqlite3')).default;

    const dbPath = path.join(process.cwd(), 'db.sqlite');
    
    // Ensure the public/images and public/images/signatures directories exist.
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log("Created public/images directory.");
    }
    const signaturesDir = path.join(process.cwd(), 'public', 'images', 'signatures');
    if (!fs.existsSync(signaturesDir)) {
        fs.mkdirSync(signaturesDir, { recursive: true });
        console.log("Created public/images/signatures directory.");
    }

    const dbExists = fs.existsSync(dbPath);
    
    const dbInstance = await open({
        filename: dbPath,
        driver: sqlite3Driver.Database,
    });

    // Enable WAL mode for better concurrency and set a busy timeout.
    await dbInstance.exec('PRAGMA journal_mode = WAL;');
    await dbInstance.exec('PRAGMA busy_timeout = 5000;');
    await dbInstance.exec('PRAGMA foreign_keys = ON;');

    if (!dbExists) {
        console.log("Database not found, initializing schema and seeding data...");
        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                fullName TEXT,
                department TEXT,
                position TEXT,
                role TEXT NOT NULL DEFAULT 'Employee' CHECK(role IN ('Employee', 'Admin'))
            );
        `);

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                imagePath TEXT,
                startDate TEXT,
                endDate TEXT,
                venue TEXT
            );
        `);

        await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            "order" INTEGER NOT NULL,
            FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
        );
        `);

        await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('video', 'document', 'quiz')),
            content TEXT,
            "order" INTEGER NOT NULL,
            imagePath TEXT,
            FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE CASCADE
        );
        `);
        
        await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS user_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lesson_id INTEGER NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
            UNIQUE(user_id, lesson_id)
        );
        `);

        await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS certificates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            course_id INTEGER,
            completion_date TEXT NOT NULL,
            certificate_number TEXT,
            type TEXT NOT NULL DEFAULT 'completion' CHECK(type IN ('completion', 'recognition')),
            reason TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE SET NULL
        );
        `);

        await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS signatories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            position TEXT,
            signatureImagePath TEXT NOT NULL
        );
        `);

         await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS enrollments (
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                PRIMARY KEY(user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
            );
        `);

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS course_signatories (
                course_id INTEGER NOT NULL,
                signatory_id INTEGER NOT NULL,
                PRIMARY KEY (course_id, signatory_id),
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
                FOREIGN KEY (signatory_id) REFERENCES signatories (id) ON DELETE CASCADE
            );
        `);

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS certificate_signatories (
                certificate_id INTEGER NOT NULL,
                signatory_id INTEGER NOT NULL,
                PRIMARY KEY (certificate_id, signatory_id),
                FOREIGN KEY (certificate_id) REFERENCES certificates (id) ON DELETE CASCADE,
                FOREIGN KEY (signatory_id) REFERENCES signatories (id) ON DELETE CASCADE
            );
        `);
        
        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                total INTEGER NOT NULL,
                attempt_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
            );
        `);


        // Seed Users
        await dbInstance.run("INSERT INTO users (id, username, fullName, department, position, role) VALUES (?, ?, ?, ?, ?, ?)", [1, 'Demo User', 'Demo User', 'Administration', 'System Administrator', 'Admin']);
        await dbInstance.run("INSERT INTO users (id, username, fullName, department, position, role) VALUES (?, ?, ?, ?, ?, ?)", [2, 'Jonathan Dumalaos', 'Jonathan Dumalaos', 'Administration', 'Director', 'Admin']);
        
        // Seed Courses
        await dbInstance.run("INSERT INTO courses (id, title, description, category, imagePath, venue) VALUES (1, 'Leadership Principles', 'Learn the core principles of effective leadership and management.', 'Management', '/images/placeholder.png', 'QAEHS Training Center, Dubai')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, imagePath, venue) VALUES (2, 'Advanced React', 'Deep dive into React hooks, context, and performance optimization.', 'Technical Skills', '/images/placeholder.png', 'Online')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, imagePath) VALUES (3, 'Cybersecurity Basics', 'Understand common threats and best practices to keep our systems secure.', 'Compliance', '/images/placeholder.png')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, imagePath) VALUES (4, 'Effective Communication', 'Master the art of clear, concise, and persuasive communication.', 'Soft Skills', '/images/placeholder.png')");
        
        // Seed Modules for Course 1
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (1, 1, 'Module 1: Introduction', 1)");
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (2, 1, 'Module 2: Deep Dive', 2)");
        
        // Seed Lessons for Module 1
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (1, 1, 'Welcome to the Course', 'video', null, 1)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\", imagePath) VALUES (2, 1, 'Core Concepts', 'document', '# Core Leadership Concepts...', 2, '/images/placeholder.png')");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (3, 2, 'Quiz on Leadership', 'quiz', '[{\"text\":\"What is the primary role of a leader?\",\"options\":[{\"text\":\"To manage tasks\",\"isCorrect\":false},{\"text\":\"To inspire and guide\",\"isCorrect\":true},{\"text\":\"To enforce rules\",\"isCorrect\":false}]}]', 1)");
        
        // Seed another quiz in the 'Advanced React' course
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (3, 2, 'React Quizzes', 1)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (4, 3, 'React Hooks Quiz', 'quiz', '[{\"text\":\"What hook is used for side effects?\",\"options\":[{\"text\":\"useState\",\"isCorrect\":false},{\"text\":\"useEffect\",\"isCorrect\":true},{\"text\":\"useContext\",\"isCorrect\":false}]}]', 1)");
        
        // Seed Enrollments
        await dbInstance.run("INSERT INTO enrollments (user_id, course_id) VALUES (1, 1)");
        await dbInstance.run("INSERT INTO enrollments (user_id, course_id) VALUES (2, 1)");
        await dbInstance.run("INSERT INTO enrollments (user_id, course_id) VALUES (1, 2)");
        await dbInstance.run("INSERT INTO enrollments (user_id, course_id) VALUES (2, 2)");


        // Seed Quiz Attempts to demonstrate analytics
        // User 1 (Demo User) performs poorly on the Leadership quiz
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (1, 3, 1, 0, 1, '2023-10-01T10:00:00Z')");
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (1, 3, 1, 0, 1, '2023-10-02T10:00:00Z')");
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (1, 3, 1, 1, 1, '2023-10-03T10:00:00Z')");

        // User 2 (Jonathan) also takes the Leadership quiz and does well
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (2, 3, 1, 1, 1, '2023-10-05T11:00:00Z')");
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (2, 3, 1, 1, 1, '2023-10-06T11:00:00Z')");
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (2, 3, 1, 1, 1, '2023-10-07T11:00:00Z')");

        // User 1 (Demo User) does well on the React quiz
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (1, 4, 2, 1, 1, '2023-11-01T10:00:00Z')");
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (1, 4, 2, 1, 1, '2023-11-02T10:00:00Z')");
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (1, 4, 2, 1, 1, '2023-11-03T10:00:00Z')");
        // User 2 (Jonathan) does well on the React quiz
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (2, 4, 2, 1, 1, '2023-11-05T11:00:00Z')");
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (2, 4, 2, 1, 1, '2023-11-06T11:00:00Z')");
        await dbInstance.run("INSERT INTO quiz_attempts (user_id, lesson_id, course_id, score, total, attempt_date) VALUES (2, 4, 2, 1, 1, '2023-11-07T11:00:00Z')");


        // Seed App Settings
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_name', 'QAEHS PRO ACADEMY']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_address', '']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_path', '/images/logo.png']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_2_path', '']);


        console.log("Database seeded successfully.");
    } else {
        // Run migrations for existing databases
        console.log("Running migrations for existing database...");
        
        await dbInstance.exec(`
            ALTER TABLE certificates ADD COLUMN type TEXT;
        `).catch(e => console.log("Could not add type column to certificates, it might exist already:", (e as Error).message));
        
        await dbInstance.exec(`
            ALTER TABLE certificates ADD COLUMN reason TEXT;
        `).catch(e => console.log("Could not add reason column to certificates, it might exist already:", (e as Error).message));
        
        await dbInstance.run("UPDATE certificates SET type = 'completion' WHERE type IS NULL").catch(e => console.log("Could not backfill certificate type:", (e as Error).message));


        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS certificate_signatories (
                certificate_id INTEGER NOT NULL,
                signatory_id INTEGER NOT NULL,
                PRIMARY KEY (certificate_id, signatory_id),
                FOREIGN KEY (certificate_id) REFERENCES certificates (id) ON DELETE CASCADE,
                FOREIGN KEY (signatory_id) REFERENCES signatories (id) ON DELETE CASCADE
            );
        `).catch(e => console.log("Could not create certificate_signatories table, it might exist already:", (e as Error).message));


        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                lesson_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                total INTEGER NOT NULL,
                attempt_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
            );
        `).catch(e => console.log("Could not create quiz_attempts table, it might exist already:", (e as Error).message));

        await dbInstance.exec(`
            ALTER TABLE signatories ADD COLUMN position TEXT;
        `).catch(e => console.log("Could not add position column to signatories, it might exist already:", (e as Error).message));

        await dbInstance.exec(`
            ALTER TABLE users ADD COLUMN department TEXT;
        `).catch(e => console.log("Could not add department column to users, it might exist already:", (e as Error).message));
        
        await dbInstance.exec(`
            ALTER TABLE users ADD COLUMN position TEXT;
        `).catch(e => console.log("Could not add position column to users, it might exist already:", (e as Error).message));
        
        await dbInstance.exec(`
            ALTER TABLE users ADD COLUMN role TEXT;
        `).catch(e => console.log("Could not add role column to users, it might exist already:", (e as Error).message));
        
        await dbInstance.exec(`
            ALTER TABLE courses ADD COLUMN startDate TEXT;
        `).catch(e => console.log("Could not add startDate column to courses, it might exist already:", (e as Error).message));

        await dbInstance.exec(`
            ALTER TABLE courses ADD COLUMN endDate TEXT;
        `).catch(e => console.log("Could not add endDate column to courses, it might exist already:", (e as Error).message));
        
        await dbInstance.exec(`
            ALTER TABLE courses ADD COLUMN venue TEXT;
        `).catch(e => console.log("Could not add venue column to courses, it might exist already:", (e as Error).message));

        await dbInstance.exec(`
            ALTER TABLE users ADD COLUMN fullName TEXT;
        `).catch(e => console.log("Could not add fullName column to users, it might exist already:", (e as Error).message));

        // Backfill fullName for existing users
        await dbInstance.run("UPDATE users SET fullName = username WHERE fullName IS NULL OR fullName = ''").catch(e => console.log("Failed to backfill fullName:", (e as Error).message));


        // Seed default settings if they don't exist for existing dbs
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_name', 'QAEHS PRO ACADEMY']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_address', '']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_path', '/images/logo.png']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_2_path', '']);
    }

    // This self-healing logic runs once on application startup.
    await dbInstance.run("INSERT OR IGNORE INTO users (id, username, fullName, department, position, role) VALUES (?, ?, ?, ?, ?, ?)", [1, 'Demo User', 'Demo User', 'Administration', 'System Administrator', 'Admin']);
    await dbInstance.run(
        "UPDATE users SET username = ?, fullName = ?, department = ?, position = ?, role = ? WHERE id = ?",
        ['Demo User', 'Demo User', 'Administration', 'System Administrator', 'Admin', 1]
    );

    // Ensure Jonathan Dumalaos exists and is an admin
    await dbInstance.run("INSERT OR IGNORE INTO users (username, fullName, department, position, role) VALUES (?, ?, ?, ?, ?)", ['Jonathan Dumalaos', 'Jonathan Dumalaos', 'Administration', 'Director', 'Admin']);
    await dbInstance.run("UPDATE users SET role = ? WHERE username = ?", ['Admin', 'Jonathan Dumalaos']);

    return dbInstance;
}

export async function getDb() {
    if (!db) {
        db = await initializeDb();
    }
    return db;
}
