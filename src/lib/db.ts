'use server';

import { open, type Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

async function initializeDb() {
    // Dynamically import sqlite3 to ensure it's loaded in the correct environment.
    const sqlite3Driver = (await import('sqlite3')).default;

    const dbPath = path.join(process.cwd(), 'db.sqlite');
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
                username TEXT NOT NULL UNIQUE
            );
        `);

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                image TEXT,
                aiHint TEXT
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

        // Seed Users
        await dbInstance.run('INSERT INTO users (username) VALUES (?)', ['Demo User']);
        
        // Seed Courses
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (1, 'Leadership Principles', 'Learn the core principles of effective leadership and management.', 'Management', 'https://placehold.co/600x400', 'leadership team')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (2, 'Advanced React', 'Deep dive into React hooks, context, and performance optimization.', 'Technical Skills', 'https://placehold.co/600x400', 'programming code')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (3, 'Cybersecurity Basics', 'Understand common threats and best practices to keep our systems secure.', 'Compliance', 'https://placehold.co/600x400', 'cyber security')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (4, 'Effective Communication', 'Master the art of clear, concise, and persuasive communication.', 'Soft Skills', 'https://placehold.co/600x400', 'communication presentation')");
        
        // Seed Modules for Course 1
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (1, 1, 'Module 1: Introduction', 1)");
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (2, 1, 'Module 2: Deep Dive', 2)");
        
        // Seed Lessons for Module 1
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (1, 1, 'Welcome to the Course', 'video', null, 1)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (2, 1, 'Core Concepts', 'document', '# Core Leadership Concepts...', 2)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (3, 2, 'Quiz on Leadership', 'quiz', '[{\"text\":\"What is the capital of France?\",\"options\":[{\"text\":\"Berlin\",\"isCorrect\":false},{\"text\":\"Paris\",\"isCorrect\":true}]}]', 1)");
        
        console.log("Database seeded successfully.");
    }

    // Always run migrations to ensure schema is up-to-date.
    // This is idempotent and safe to run multiple times.
    const columns = await dbInstance.all("PRAGMA table_info(user_progress)");
    const hasLastAccessedColumn = columns.some(col => col.name === 'last_accessed_at');

    if (!hasLastAccessedColumn) {
        console.log("Running migration: Adding 'last_accessed_at' to 'user_progress' table.");
        await dbInstance.exec(`
            ALTER TABLE user_progress ADD COLUMN last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log("Migration complete.");
    }


    return dbInstance;
}

export async function getDb() {
    if (!db) {
        db = await initializeDb();
    }
    return db;
}
