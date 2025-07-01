import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

async function initializeDb() {
    const dbPath = path.join(process.cwd(), 'db.sqlite');
    
    const dbInstance = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
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

    const count = await dbInstance.get('SELECT COUNT(id) as count FROM courses');

    if (count.count === 0) {
        await dbInstance.exec(`
            INSERT INTO courses (title, description, category, image, aiHint) VALUES
            ('Leadership Principles', 'Learn the core principles of effective leadership and management.', 'Management', 'https://placehold.co/600x400', 'leadership team'),
            ('Advanced React', 'Deep dive into React hooks, context, and performance optimization.', 'Technical Skills', 'https://placehold.co/600x400', 'programming code'),
            ('Cybersecurity Basics', 'Understand common threats and best practices to keep our systems secure.', 'Compliance', 'https://placehold.co/600x400', 'cyber security'),
            ('Effective Communication', 'Master the art of clear, concise, and persuasive communication.', 'Soft Skills', 'https://placehold.co/600x400', 'communication presentation'),
            ('Data Analysis with Python', 'Learn to analyze data using Pandas, NumPy, and Matplotlib.', 'Technical Skills', 'https://placehold.co/600x400', 'data analytics'),
            ('Project Management Fundamentals', 'Covering the basics of Agile, Scrum, and Waterfall methodologies.', 'Management', 'https://placehold.co/600x400', 'project management');
        `);
    }

    return dbInstance;
}

export async function getDb() {
    if (!db) {
        db = await initializeDb();
    }
    return db;
}
