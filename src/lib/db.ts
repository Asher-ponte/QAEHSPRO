
'use server';

import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';

// This is the singleton promise that will be reused across requests.
let dbPromise: Promise<Database> | null = null;

// This function contains the actual database setup logic.
// It will only be called once per server instance thanks to the singleton pattern in getDb().
const setupDatabase = async (): Promise<Database> => {
    console.log("Setting up new database connection...");
    
    const dbPath = path.join(process.cwd(), 'db.sqlite');
    const imagesDir = path.join(process.cwd(), 'public', 'images');

    // Ensure directories exist. Since this function is called only once, this is safe.
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    await fs.mkdir(imagesDir, { recursive: true });
    
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    // These settings are critical for stability and performance in a web server environment.
    await db.exec('PRAGMA journal_mode = WAL;');
    await db.exec('PRAGMA busy_timeout = 5000;');
    await db.exec('PRAGMA foreign_keys = ON;');
    await db.exec('PRAGMA synchronous = NORMAL;');

    // Schema creation - using "IF NOT EXISTS" makes it safe to run on every startup.
    await db.exec(`
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
    
    // Seed data - "INSERT OR IGNORE" is idempotent and safe for concurrent execution.
    await db.run("INSERT OR IGNORE INTO users (id, username, fullName, role) VALUES (?, ?, ?, ?)", [1, 'admin', 'Admin User', 'Admin']);
    await db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_name', 'QAEHS PRO ACADEMY']);
    await db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_path', '/images/logo.png']);
    
    console.log("Database connection is ready.");
    return db;
}

/**
 * This is the exported function that all application code will use.
 * It ensures that setupDatabase() is only ever called once per server instance
 * by using a singleton promise. This is safe for concurrent requests.
 */
export async function getDb(): Promise<Database> {
    if (!dbPromise) {
        dbPromise = setupDatabase();
    }
    return dbPromise;
}
