
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

    await dbInstance.exec('PRAGMA foreign_keys = ON;');

    if (!dbExists) {
        console.log("Database not found, initializing schema and seeding data...");
        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
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
            course_id INTEGER NOT NULL,
            completion_date TEXT NOT NULL,
            certificate_number TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
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


        // Seed Users
        await dbInstance.run("INSERT INTO users (username, department, position, role) VALUES (?, ?, ?, ?)", ['Demo User', 'Administration', 'System Administrator', 'Admin']);
        await dbInstance.run("INSERT INTO users (username, department, position, role) VALUES (?, ?, ?, ?)", ['Jonathan Dumalaos', 'Administration', 'Director', 'Admin']);
        
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
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (3, 2, 'Quiz on Leadership', 'quiz', '[{\"text\":\"What is the capital of France?\",\"options\":[{\"text\":\"Berlin\",\"isCorrect\":false},{\"text\":\"Paris\",\"isCorrect\":true}]}]', 1)");
        
        // Seed initial enrollment for the admin user
        await dbInstance.run("INSERT INTO enrollments (user_id, course_id) VALUES (1, 1)");

        // Seed App Settings
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_name', 'QAEHS PRO ACADEMY']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_address', '']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_path', '/images/logo.png']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_2_path', '']);


        console.log("Database seeded successfully.");
    } else {
        // Run migrations for existing databases
        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS certificates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                completion_date TEXT NOT NULL,
                certificate_number TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
            );
        `).catch(e => console.log("Could not create certificates table, it might exist already:", e.message));

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS signatories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                position TEXT,
                signatureImagePath TEXT NOT NULL
            );
        `).catch(e => console.log("Could not create signatories table, it might exist already:", e.message));
        
        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS enrollments (
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                PRIMARY KEY(user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
            );
        `).catch(e => console.log("Could not create enrollments table, it might exist already:", e.message));
        
        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `).catch(e => console.log("Could not create app_settings table, it might exist already:", e.message));

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS course_signatories (
                course_id INTEGER NOT NULL,
                signatory_id INTEGER NOT NULL,
                PRIMARY KEY (course_id, signatory_id),
                FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
                FOREIGN KEY (signatory_id) REFERENCES signatories (id) ON DELETE CASCADE
            );
        `).catch(e => console.log("Could not create course_signatories table, it might exist already:", e.message));

        await dbInstance.exec(`
            ALTER TABLE signatories ADD COLUMN position TEXT;
        `).catch(e => console.log("Could not add position column to signatories, it might exist already:", e.message));

        await dbInstance.exec(`
            ALTER TABLE users ADD COLUMN department TEXT;
        `).catch(e => console.log("Could not add department column to users, it might exist already:", e.message));
        
        await dbInstance.exec(`
            ALTER TABLE users ADD COLUMN position TEXT;
        `).catch(e => console.log("Could not add position column to users, it might exist already:", e.message));
        
        await dbInstance.exec(`
            ALTER TABLE users ADD COLUMN role TEXT;
        `).catch(e => console.log("Could not add role column to users, it might exist already:", e.message));
        
        await dbInstance.exec(`
            ALTER TABLE courses ADD COLUMN startDate TEXT;
        `).catch(e => console.log("Could not add startDate column to courses, it might exist already:", e.message));

        await dbInstance.exec(`
            ALTER TABLE courses ADD COLUMN endDate TEXT;
        `).catch(e => console.log("Could not add endDate column to courses, it might exist already:", e.message));
        
        await dbInstance.exec(`
            ALTER TABLE certificates ADD COLUMN certificate_number TEXT;
        `).catch(e => console.log("Could not add certificate_number column to certificates, it might exist already:", e.message));

        await dbInstance.exec(`
            ALTER TABLE courses ADD COLUMN venue TEXT;
        `).catch(e => console.log("Could not add venue column to courses, it might exist already:", e.message));

        // Seed default settings if they don't exist for existing dbs
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_name', 'QAEHS PRO ACADEMY']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_address', '']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_path', '/images/logo.png']);
        await dbInstance.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_2_path', '']);
    }


    return dbInstance;
}

export async function getDb() {
    if (!db) {
        db = await initializeDb();
    }
    // Every time, ensure the admin user exists and has the correct role. This is self-healing.
    await db.run("INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)", [1, 'Demo User']);
    await db.run(
        "UPDATE users SET username = ?, department = ?, position = ?, role = ? WHERE id = ?",
        ['Demo User', 'Administration', 'System Administrator', 'Admin', 1]
    );

    // Ensure Jonathan Dumalaos exists and is an admin
    await db.run("INSERT OR IGNORE INTO users (username, department, position, role) VALUES (?, ?, ?, ?)", ['Jonathan Dumalaos', 'Administration', 'Director', 'Admin']);
    await db.run("UPDATE users SET role = ? WHERE username = ?", ['Admin', 'Jonathan Dumalaos']);
    
    return db;
}
