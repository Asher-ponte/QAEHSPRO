
'use server';

import 'dotenv/config'; // Ensures environment variables are loaded
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

const initializePool = () => {
    if (pool) {
        return pool;
    }
    
    // Validate that all required environment variables are set.
    const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT'];
    for (const varName of requiredEnv) {
        if (!process.env[varName]) {
            throw new Error(`Missing required environment variable for database connection: ${varName}`);
        }
    }

    const config: mysql.PoolOptions = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || '3306', 10),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    };

    // Use socketPath for Unix socket connections (common in GCP App Engine, Cloud Run)
    if (process.env.DB_SOCKET_PATH) {
        config.socketPath = process.env.DB_SOCKET_PATH;
    }
    
    console.log("Initializing new MySQL connection pool...");
    pool = mysql.createPool(config);

    // Optional: Test the connection on initialization
    pool.getConnection().then(conn => {
        console.log("Database connection successful.");
        conn.release();
    }).catch(err => {
        console.error("Failed to establish database connection:", err);
        pool = null; // Reset pool on failure
    });

    return pool;
};

// This function now simply returns the single, shared connection pool.
export const getDb = async (): Promise<mysql.Pool> => {
    if (!pool) {
        pool = initializePool();
    }
    return pool;
};
