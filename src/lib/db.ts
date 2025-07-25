
'use server';

import 'dotenv/config'; // Ensures environment variables are loaded
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

const initializePool = (): mysql.Pool => {
    // This function is now responsible for creating a *new* pool if one doesn't exist
    // or if it has been cleared due to an error.
    
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

    if (process.env.DB_SOCKET_PATH && !process.env.DB_SOCKET_PATH.includes('your_db_socket_path')) {
        config.socketPath = process.env.DB_SOCKET_PATH;
    }
    
    console.log("Initializing new MySQL connection pool...");
    return mysql.createPool(config);
};

/**
 * Returns the singleton MySQL connection pool.
 * This is the primary way to interact with the database.
 * The pool handles connection acquisition, release, and transactions.
 * This new implementation ensures the pool is valid on each request.
 */
export const getDb = async (): Promise<mysql.Pool> => {
    // If the pool doesn't exist, create it.
    if (!pool) {
        pool = initializePool();
    }
    
    // Before returning the pool, we can add a quick health check.
    // This helps to recover from transient network errors.
    try {
        const connection = await pool.getConnection();
        connection.release();
    } catch (err) {
        console.error("Database connection pool is unhealthy. Re-initializing.", err);
        // End the broken pool
        if (pool) {
            await pool.end();
        }
        // Force re-initialization on the next call
        pool = initializePool();
    }

    return pool;
};
