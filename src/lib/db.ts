
'use server';

import 'dotenv/config'; // Ensures environment variables are loaded
import mysql from 'mysql2/promise';

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
        connectionLimit: 5, // Reduced for serverless to avoid resource exhaustion
        queueLimit: 0,
    };

    if (process.env.DB_SOCKET_PATH && !process.env.DB_SOCKET_PATH.includes('your_db_socket_path')) {
        config.socketPath = process.env.DB_SOCKET_PATH;
    }
    
    console.log("Initializing new MySQL connection pool for request...");
    return mysql.createPool(config);
};

/**
 * Returns a fresh MySQL connection pool for each request.
 * This ensures no stale connections are reused, addressing network errors.
 */
export const getDb = async (): Promise<mysql.Pool> => {
    const pool = initializePool();

    // Perform a health check with a simple query
    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
    } catch (err) {
        console.error("Database connection pool health check failed. Ending pool.", err);
        await pool.end();
        throw new Error('Failed to establish a valid database connection');
    }

    // Ensure the pool is cleaned up after the request
    process.on('beforeExit', async () => {
        await pool.end();
    });

    return pool;
};
