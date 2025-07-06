
'use server';

import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { SITES } from './sites';

// Use a Map to hold a singleton promise for each site's database.
const dbPromises = new Map<string, Promise<Database>>();

const setupDatabase = async (siteId: string): Promise<Database> => {
    console.log(`Setting up new database connection for site: ${siteId}`);
    
    const site = SITES.find(s => s.id === siteId);
    if (!site) {
        throw new Error(`Invalid site ID: ${siteId}`);
    }

    const dataDir = path.join(process.cwd(), 'data');
    const dbPath = path.join(dataDir, `${site.id}.sqlite`);
    const imagesDir = path.join(process.cwd(), 'public', 'images');

    // Ensure directories exist.
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(imagesDir, { recursive: true });
    
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    // Critical performance and stability settings
    await db.exec('PRAGMA journal_mode = WAL;');
    await db.exec('PRAGMA busy_timeout = 5000;');
    await db.exec('PRAGMA foreign_keys = ON;');
    await db.exec('PRAGMA synchronous = NORMAL;');

    // Schema creation
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            fullName TEXT,
            department TEXT,
            position TEXT,
            role TEXT NOT NULL DEFAULT 'Employee' CHECK(role IN ('Employee', 'Admin')),
            type TEXT NOT NULL DEFAULT 'Employee' CHECK(type IN ('Employee', 'External'))
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
    
    // Seed data
    await db.run(
        `INSERT INTO users (id, username, fullName, role, type) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           username=excluded.username,
           fullName=excluded.fullName,
           role=excluded.role,
           type=excluded.type;`,
        [1, 'Demo User', 'Demo User', 'Admin', 'Employee']
    );
    await db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_name', site.name]);
    await db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", ['company_logo_path', '/images/logo.png']);
    
    console.log(`Database connection for site '${siteId}' is ready.`);
    return db;
}

export async function getDb(siteId: string): Promise<Database> {
    if (!SITES.some(s => s.id === siteId)) {
        throw new Error(`Attempted to access an invalid site: ${siteId}`);
    }

    let dbPromise = dbPromises.get(siteId);
    if (!dbPromise) {
        dbPromise = setupDatabase(siteId);
        dbPromises.set(siteId, dbPromise);
    }
    return dbPromise;
}
