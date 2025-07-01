import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';
import bcrypt from 'bcrypt';

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

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        "order" INTEGER NOT NULL,
        FOREIGN KEY (course_id) REFERENCES courses (id)
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
        FOREIGN KEY (module_id) REFERENCES modules (id)
      );
    `);
    
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        lesson_id INTEGER NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (lesson_id) REFERENCES lessons (id),
        UNIQUE(user_id, lesson_id)
      );
    `);

    const userCount = await dbInstance.get('SELECT COUNT(id) as count FROM users');
    if (userCount.count === 0) {
        const hashedPassword = await bcrypt.hash('password', 10);
        await dbInstance.run('INSERT INTO users (username, password) VALUES (?, ?)', ['johndoe', hashedPassword]);
    }

    const courseCount = await dbInstance.get('SELECT COUNT(id) as count FROM courses');
    if (courseCount.count === 0) {
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (1, 'Leadership Principles', 'Learn the core principles of effective leadership and management.', 'Management', 'https://placehold.co/600x400', 'leadership team')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (2, 'Advanced React', 'Deep dive into React hooks, context, and performance optimization.', 'Technical Skills', 'https://placehold.co/600x400', 'programming code')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (3, 'Cybersecurity Basics', 'Understand common threats and best practices to keep our systems secure.', 'Compliance', 'https://placehold.co/600x400', 'cyber security')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (4, 'Effective Communication', 'Master the art of clear, concise, and persuasive communication.', 'Soft Skills', 'https://placehold.co/600x400', 'communication presentation')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (5, 'Data Analysis with Python', 'Learn to analyze data using Pandas, NumPy, and Matplotlib.', 'Technical Skills', 'https://placehold.co/600x400', 'data analytics')");
        await dbInstance.run("INSERT INTO courses (id, title, description, category, image, aiHint) VALUES (6, 'Project Management Fundamentals', 'Covering the basics of Agile, Scrum, and Waterfall methodologies.', 'Management', 'https://placehold.co/600x400', 'project management')");
    }

    const moduleCount = await dbInstance.get('SELECT COUNT(id) as count FROM modules');
    if (moduleCount.count === 0) {
        // Modules for course 1 as an example
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (1, 1, 'Module 1: Introduction', 1)");
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (2, 1, 'Module 2: Deep Dive', 2)");
        await dbInstance.run("INSERT INTO modules (id, course_id, title, \"order\") VALUES (3, 1, 'Module 3: Conclusion', 3)");
        
        // Lessons for module 1
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (1, 1, 'Welcome to the Course', 'video', null, 1)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (2, 1, 'Core Concepts', 'video', null, 2)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (3, 1, 'Reading: Getting Started', 'document', '# Welcome to Leadership\n\nThis first lesson covers the basic principles of what it means to be a good leader in a fast-paced environment.\n\n*   Principle 1: Lead by example.\n*   Principle 2: Communicate clearly.\n*   Principle 3: Empower your team.', 3)");
        
        // Lessons for module 2
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (4, 2, 'Advanced Topics', 'video', null, 1)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (5, 2, 'Practical Application', 'video', null, 2)");
        
        // Lessons for module 3
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (6, 3, 'Summary and Review', 'video', null, 1)");
        await dbInstance.run("INSERT INTO lessons (id, module_id, title, type, content, \"order\") VALUES (7, 3, 'Course Quiz', 'quiz', null, 2)");
    }
    
    const progressCount = await dbInstance.get('SELECT COUNT(id) as count FROM user_progress');
    if (progressCount.count === 0) {
        // Mark lesson 1 as complete for user 1 ('johndoe')
        await dbInstance.run("INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (1, 1, 1)");
    }

    return dbInstance;
}

export async function getDb() {
    if (!db) {
        db = await initializeDb();
    }
    return db;
}
