
'use server';

import { open, type Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

// Module-level cache for the database connection and the initialization promise.
let db: Database | null = null;
let initializationPromise: Promise<Database> | null = null;

async function setupSchema(dbInstance: Database) {
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            fullName TEXT,
            department TEXT,
            position TEXT,
            role TEXT NOT NULL DEFAULT 'Employee' CHECK(role IN ('Employee', 'Admin'))
        );
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
        CREATE TABLE IF NOT EXISTS modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            "order" INTEGER NOT NULL,
            FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
        );
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
        CREATE TABLE IF NOT EXISTS user_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lesson_id INTEGER NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
            UNIQUE(user_id, lesson_id)
        );
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
        CREATE TABLE IF NOT EXISTS signatories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            position TEXT,
            signatureImagePath TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS enrollments (
            user_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            PRIMARY KEY(user_id, course_id),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS course_signatories (
            course_id INTEGER NOT NULL,
            signatory_id INTEGER NOT NULL,
            PRIMARY KEY (course_id, signatory_id),
            FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
            FOREIGN KEY (signatory_id) REFERENCES signatories (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS certificate_signatories (
            certificate_id INTEGER NOT NULL,
            signatory_id INTEGER NOT NULL,
            PRIMARY KEY (certificate_id, signatory_id),
            FOREIGN KEY (certificate_id) REFERENCES certificates (id) ON DELETE CASCADE,
            FOREIGN KEY (signatory_id) REFERENCES signatories (id) ON DELETE CASCADE
        );
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
}

async function seedData(dbInstance: Database) {
    const users = await dbInstance.get('SELECT COUNT(*) as count FROM users');
    if (users && users.count > 0) {
        return; // Database already has users, so we assume it's seeded.
    }

    console.log("Database is empty, seeding data...");
    
    await dbInstance.exec('BEGIN TRANSACTION');
    try {
        await dbInstance.run("INSERT INTO users (id, username, fullName, department, position, role) VALUES (?, ?, ?, ?, ?, ?)", [1, 'Demo User', 'Demo User', 'Administration', 'System Administrator', 'Admin']);
        await dbInstance.run("INSERT INTO users (id, username, fullName, department, position, role) VALUES (?, ?, ?, ?, ?, ?)", [2, 'Jonathan Dumalaos', 'Jonathan Dumalaos', 'Administration', 'Director', 'Admin']);
        await dbInstance.run("INSERT INTO courses (id, title, description, category, imagePath, venue) VALUES (1, 'Leadership Principles', 'Learn the core principles of effective leadership and management.', 'Management', '/images/placeholder.png', 'QAEHS Training Center, Dubai')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, imagePath, venue) VALUES (2, 'Advanced React', 'Deep dive into React hooks, context, and performance optimization.', 'Technical Skills', '/images/placeholder.png', 'Online')");
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (1, 1, 'Module 1: Introduction', 1)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (1, 1, 'Welcome to the Course', 'video', null, 1)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\", imagePath) VALUES (2, 1, 'Core Concepts', 'document', '# Core Leadership Concepts...', 2, '/images/placeholder.png')");
        await dbInstance.run("INSERT INTO enrollments (user_id, course_id) VALUES (1, 1)");
        await dbInstance.run("INSERT INTO enrollments (user_id, course_id) VALUES (2, 1)");
        await dbInstance.run("INSERT INTO enrollments (user_id, course_id) VALUES (1, 2)");
        await dbInstance.run("INSERT INTO app_settings (key, value) VALUES (?, ?)", ['company_name', 'QAEHS PRO ACADEMY']);
        await dbInstance.run("INSERT INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_path', '/images/logo.png']);
        
        await dbInstance.exec('COMMIT');
        console.log("Database seeded successfully.");
    } catch (e) {
        await dbInstance.exec('ROLLBACK');
        console.error("Failed to seed database:", e);
        throw e;
    }
}

async function initializeDb(): Promise<Database> {
    const sqlite3Driver = (await import('sqlite3')).default;
    const dbPath = path.join(process.cwd(), 'db.sqlite');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log("Created public/images directory.");
    }

    const dbInstance = await open({
        filename: dbPath,
        driver: sqlite3Driver.Database,
    });

    await dbInstance.exec('PRAGMA journal_mode = WAL;');
    await dbInstance.exec('PRAGMA busy_timeout = 5000;');
    await dbInstance.exec('PRAGMA foreign_keys = ON;');

    await setupSchema(dbInstance);
    await seedData(dbInstance);

    return dbInstance;
}

export async function getDb(): Promise<Database> {
    if (db) {
        return db;
    }
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = initializeDb().then(initializedDb => {
        console.log("Database connection initialized and cached.");
        db = initializedDb;
        return db;
    }).catch(err => {
        initializationPromise = null;
        console.error("DATABASE INITIALIZATION FAILED:", err);
        throw err;
    });

    return initializationPromise;
}
