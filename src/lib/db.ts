
'use server';

import 'dotenv/config'; // Ensures environment variables are loaded
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

const initializePool = (): mysql.Pool => {
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
    const newPool = mysql.createPool(config);

    // Ensure the pool is cleaned up gracefully on server exit.
    // This listener is now attached only once.
    process.on('beforeExit', async () => {
        if (newPool) {
            console.log("Closing database connection pool...");
            await newPool.end();
        }
    });
    
    return newPool;
};

/**
 * Returns a singleton instance of the MySQL connection pool.
 * The pool is created on the first call and reused for subsequent calls.
 */
export const getDb = async (): Promise<mysql.Pool> => {
    if (!pool) {
        pool = initializePool();
    }
    
    // Perform a quick health check on an existing or new pool
    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
    } catch (err) {
        console.error("Database connection pool health check failed.", err);
        // If the pool is unhealthy, reset it and try to create a new one.
        if (pool) await pool.end();
        pool = initializePool(); // Attempt to re-initialize
    }

    return pool;
};
