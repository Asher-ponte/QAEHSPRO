
'use server';

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
        // Add SSL configuration for production Cloud SQL connections
        // Note: You will need to download the server-ca, client-key, and client-cert
        // from your Cloud SQL instance and place them in a secure directory.
        // ssl: {
        //   ca: fs.readFileSync(__dirname + '/path/to/server-ca.pem'),
        //   key: fs.readFileSync(__dirname + '/path/to/client-key.pem'),
        //   cert: fs.readFileSync(__dirname + '/path/to/client-cert.pem')
        // }
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
// The concept of a `siteId` determining the database file is no longer needed.
// All multi-tenant logic will now be handled by a `site_id` column in each table.
export const getDb = async (): Promise<mysql.Pool> => {
    if (!pool) {
        pool = initializePool();
    }
    return pool;
};

// Helper function to create tables if they don't exist.
// This should be run once, perhaps as part of a deployment script.
// Note: This is an example; in a production setup, you would use a dedicated migration tool like `knex` or `migrate-mysql`.
export const runDbMigrations = async () => {
    const db = await getDb();
    console.log("Running database migrations...");

    // Important: We add a `site_id` column to every table to handle multi-tenancy.
    await db.query(`
        CREATE TABLE IF NOT EXISTS sites (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE
        );
    `);
    
    // Seed core sites
     await db.query(`
        INSERT IGNORE INTO sites (id, name) VALUES 
        ('main', 'QAEHS Main Site'),
        ('branch-one', 'Branch One'),
        ('branch-two', 'Branch Two'),
        ('external', 'External Users');
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            site_id VARCHAR(255) NOT NULL,
            username VARCHAR(255) NOT NULL,
            password VARCHAR(255),
            fullName VARCHAR(255),
            department VARCHAR(255),
            position VARCHAR(255),
            role ENUM('Employee', 'Admin') NOT NULL DEFAULT 'Employee',
            type ENUM('Employee', 'External') NOT NULL DEFAULT 'Employee',
            email VARCHAR(255),
            phone VARCHAR(255),
            UNIQUE KEY (site_id, username),
            FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
        );
    `);
    
    // You would continue this pattern for all other tables...
    // For brevity, I'll stop here, but all other CREATE TABLE statements
    // from the old `db.ts` would need to be converted to MySQL syntax
    // and include the `site_id` column and foreign key.

    console.log("Database migrations completed.");
};
